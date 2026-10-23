import { useEffect, useState, useMemo } from 'react';

const Gases = () => {
    const [gases, setGases] = useState([]);
    const [setores, setSetores] = useState([]);
    const [fornecedores, setFornecedores] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [manifold, setManifold] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportando, setExportando] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('manifold'); // 'manifold', 'estoque' ou 'historico'
    const [agora, setAgora] = useState(new Date());
    
    // Modais
    const [modalViradaManifold, setModalViradaManifold] = useState(false);
    const [modalCompra, setModalCompra] = useState(false);
    const [modalEnvioSetor, setModalEnvioSetor] = useState(false);
    const [modalNovoGas, setModalNovoGas] = useState(false);

    // Formulários
    const [formNovoGas, setFormNovoGas] = useState({ tipo_gas: '', capacidade_cilindro: '', estoque_minimo: 5 });
    
    // Formulário de Compra com Fornecedor Homologado
    const [formCompra, setFormCompra] = useState({ 
        tipo_gas_id: '', 
        quantidade_cilindros: '', 
        valor_unitario_cilindro: '', 
        numero_nf: '',
        fornecedor_id: '',
        fornecedor_nome: '',
        observacao: '' 
    });
    const [comprovanteCompra, setComprovanteCompra] = useState(null);
    
    // Formulário de Envio Setorial
    const [formEnvio, setFormEnvio] = useState({ 
        tipo_gas_id: '', 
        quantidade_cilindros: 1, 
        setor_destino_id: '', 
        observacao: '' 
    });
    
    // Formulário de Virada com Campos de Pressão
    const [dadosVirada, setDadosVirada] = useState({
        pressao_rede_bar: '4.5',
        pressao_cilindros_bar: '150',
        observacao: ''
    });

    const API_URL = '/api';
    const BASE_URL = '';
    
    const usuarioSalvo = localStorage.getItem('user');
    const user = usuarioSalvo ? JSON.parse(usuarioSalvo) : { nome: 'Técnico', nivel: '' };
    const nivel = user.nivel;

    useEffect(() => {
        const timer = setInterval(() => setAgora(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const carregarDados = async () => {
        setLoading(true);
        try {
            const headers = { 'x-usuario-nivel': nivel };
            const [resGases, resHist, resManifold, resSetores, resForn] = await Promise.all([
                fetch(`${API_URL}/gases`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/gases/historico`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/gases/manifold`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/setores`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/fornecedores`, { headers }).then(r => r.json())
            ]);

            setGases(Array.isArray(resGases) ? resGases : []);
            setHistorico(Array.isArray(resHist) ? resHist : []);
            setManifold(resManifold);
            setSetores(Array.isArray(resSetores) ? resSetores : []);
            setFornecedores(Array.isArray(resForn) ? resForn : []);
        } catch (err) {
            console.error("Erro ao carregar central de gases:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    // ⏱️ CÁLCULO DINÂMICO DE TEMPO DE CONSUMO
    const calcularTempoEmUso = (dataUltimaViradaStr) => {
        if (!dataUltimaViradaStr) return { texto: 'Recém instalado', minutosTotais: 0, horasDecimais: 0 };
        const inicio = new Date(dataUltimaViradaStr);
        const diffMs = Math.max(0, agora - inicio);
        const minutosTotais = Math.floor(diffMs / (1000 * 60));
        const horasDecimais = Number((minutosTotais / 60).toFixed(1));
        const dias = Math.floor(minutosTotais / 1440);
        const horas = Math.floor((minutosTotais % 1440) / 60);
        const minutos = minutosTotais % 60;

        let texto = `${minutos} minutos`;
        if (dias > 0) texto = `${dias}d ${horas}h ${minutos}m`;
        else if (horas > 0) texto = `${horas}h ${minutos}m`;

        return { texto, minutosTotais, horasDecimais };
    };

    const statusTempoRamal = useMemo(() => {
        return calcularTempoEmUso(manifold?.data_ultima_virada);
    }, [manifold?.data_ultima_virada, agora]);

    // Média de horas de duração das últimas viradas
    const historicoViradas = useMemo(() => {
        return historico.filter(h => h.tempo_duracao_horas && Number(h.tempo_duracao_horas) > 0);
    }, [historico]);

    const mediaHorasVirada = useMemo(() => {
        if (historicoViradas.length === 0) return null;
        return Number((historicoViradas.reduce((acc, h) => acc + Number(h.tempo_duracao_horas), 0) / historicoViradas.length).toFixed(1));
    }, [historicoViradas]);

    // 🔮 CÁLCULO PREDITIVO DE PRÓXIMA VIRADA
    const predicaoVirada = useMemo(() => {
        if (!mediaHorasVirada || !manifold?.data_ultima_virada) return null;
        
        const horasDecorridas = statusTempoRamal.horasDecimais;
        const horasRestantes = Math.max(0, Number((mediaHorasVirada - horasDecorridas).toFixed(1)));
        const percentualConsumido = Math.min(100, Math.round((horasDecorridas / mediaHorasVirada) * 100));

        const dataEstimada = new Date(new Date(manifold.data_ultima_virada).getTime() + (mediaHorasVirada * 60 * 60 * 1000));
        const alertaCritico = horasRestantes <= 4;

        return {
            horasRestantes,
            percentualConsumido,
            dataEstimada,
            alertaCritico
        };
    }, [mediaHorasVirada, manifold?.data_ultima_virada, statusTempoRamal.horasDecimais]);

    // Handlers
    const handleViradaManifold = async (e) => {
        e.preventDefault();
        
        const obsFormatada = [
            `Pressão de Rede: ${dadosVirada.pressao_rede_bar} bar | Pressão Cilindros: ${dadosVirada.pressao_cilindros_bar} bar`,
            dadosVirada.observacao ? `Obs: ${dadosVirada.observacao.trim()}` : ''
        ].filter(Boolean).join(' | ');

        try {
            const res = await fetch(`${API_URL}/gases/manifold/virada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify({
                    ramal_que_esvaziou: manifold?.ramal_ativo || 'A',
                    tecnico_nome: user.nome,
                    observacao: obsFormatada
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ ${data.message}`);
                setModalViradaManifold(false);
                setDadosVirada({ pressao_rede_bar: '4.5', pressao_cilindros_bar: '150', observacao: '' });
                carregarDados();
            } else {
                alert(`❌ Erro: ${data.error}`);
            }
        } catch (err) {
            alert("Erro de conexão ao processar virada do manifold.");
        }
    };

    const handleRegistrarCompra = async (e) => {
        e.preventDefault();
        
        // Localiza fornecedor se selecionado pelo select
        let nomeFornFinal = formCompra.fornecedor_nome;
        if (formCompra.fornecedor_id) {
            const fSel = fornecedores.find(f => String(f.id) === String(formCompra.fornecedor_id));
            if (fSel) nomeFornFinal = fSel.nome_fantasia || fSel.razao_social;
        }

        let obsFinal = formCompra.observacao || '';
        if (formCompra.numero_nf || nomeFornFinal) {
            const detalhes = [
                formCompra.numero_nf ? `NF: ${formCompra.numero_nf}` : '',
                nomeFornFinal ? `Forn: ${nomeFornFinal}` : ''
            ].filter(Boolean).join(' | ');
            obsFinal = obsFinal ? `${detalhes} | ${obsFinal}` : detalhes;
        }

        const valorLimpo = String(formCompra.valor_unitario_cilindro || '0').replace(',', '.');

        const formData = new FormData();
        formData.append('tipo_gas_id', formCompra.tipo_gas_id);
        formData.append('quantidade_cilindros', formCompra.quantidade_cilindros);
        formData.append('valor_unitario_cilindro', valorLimpo);
        formData.append('observacao', obsFinal);
        formData.append('tecnico_nome', user.nome);
        if (comprovanteCompra) formData.append('comprovante_pdf', comprovanteCompra);

        try {
            const res = await fetch(`${API_URL}/gases/entrada`, {
                method: 'POST',
                headers: { 'x-usuario-nivel': nivel },
                body: formData
            });
            if (res.ok) {
                alert("Entrada de cilindros e comprovante registados com sucesso! 🛒📄");
                setModalCompra(false);
                setFormCompra({ 
                    tipo_gas_id: '', 
                    quantidade_cilindros: '', 
                    valor_unitario_cilindro: '', 
                    numero_nf: '',
                    fornecedor_id: '',
                    fornecedor_nome: '',
                    observacao: '' 
                });
                setComprovanteCompra(null);
                carregarDados();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.error}`);
            }
        } catch (err) {
            alert("Erro ao processar compra de cilindros.");
        }
    };

    const handleRegistrarEnvioSetor = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/gases/consumo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify({ ...formEnvio, tecnico_nome: user.nome })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ ${data.message}`);
                setModalEnvioSetor(false);
                setFormEnvio({ tipo_gas_id: '', quantidade_cilindros: 1, setor_destino_id: '', observacao: '' });
                carregarDados();
            } else {
                alert(`❌ Erro: ${data.error}`);
            }
        } catch (err) {
            alert("Erro ao registrar envio do cilindro.");
        }
    };

    const handleCadastrarGas = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/gases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify(formNovoGas)
            });
            if (res.ok) {
                alert("Novo gás medicinal adicionado com sucesso!");
                setModalNovoGas(false);
                setFormNovoGas({ tipo_gas: '', capacidade_cilindro: '', estoque_minimo: 5 });
                carregarDados();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (err) {
            alert("Erro ao cadastrar gás.");
        }
    };

    const handleExportarExcel = async () => {
        setExportando(true);
        try {
            const res = await fetch(`${API_URL}/relatorios/exportar/gases`, {
                headers: { 'x-usuario-nivel': nivel }
            });
            if (!res.ok) throw new Error("Erro ao gerar planilha.");

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `rastreabilidade_gases_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            alert("Falha na exportação: " + err.message);
        } finally {
            setExportando(false);
        }
    };

    const gasOxigenio = gases.find(g => g.tipo_gas?.toLowerCase().includes('oxigênio'));
    const totalCilindrosConsumidos = historico
        .filter(h => h.tipo_movimentacao === 'Saida')
        .reduce((acc, curr) => acc + Number(curr.quantidade_cilindros || 0), 0);

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* 🖨️ MOTOR DE IMPRESSÃO ISOLADO DO LIVRO DE REGISTO */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                        background: transparent !important;
                    }
                    .gases-print-container, 
                    .gases-print-container * {
                        visibility: visible !important;
                    }
                    .gases-print-container {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 20px !important;
                        background: white !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .gases-card-print {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* CABEÇALHO */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4 no-print">
                <div className="flex items-center gap-3">
                    <span className="text-2xl bg-sky-100 text-sky-600 p-3 rounded-2xl">🧪</span>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Central de Gases Medicinais</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gestão do Manifold de Oxigênio (2x12) e Rastreio Setorial</p>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                    <button 
                        onClick={() => setModalViradaManifold(true)} 
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                        <span>🔄</span> Virar Manifold (12 Cil.)
                    </button>
                    <button 
                        onClick={() => setModalEnvioSetor(true)} 
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                        title="Enviar cilindros para Centro Cirúrgico, UTI, Enfermarias, etc."
                    >
                        <span>🏥</span> Enviar p/ Setor
                    </button>
                    <button 
                        onClick={() => setModalCompra(true)} 
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                        <span>🛒</span> Entrada / Comprovante
                    </button>
                    <button 
                        onClick={handleExportarExcel} 
                        disabled={exportando}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                        <span>📊</span> {exportando ? '...' : 'Excel'}
                    </button>
                    <button 
                        onClick={() => {
                            setAbaAtiva('historico');
                            setTimeout(() => window.print(), 250);
                        }} 
                        className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                        title="Imprimir Livro de Rastreabilidade para Auditoria / Anvisa"
                    >
                        <span>🖨️</span> Imprimir Livro
                    </button>
                </div>
            </div>

            {/* CARDS DE INDICADORES RÁPIDOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 no-print">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Tempo do Ramal Ativo</span>
                        <p className="text-base font-black text-emerald-600 mt-0.5">
                            ⏱️ {statusTempoRamal.texto}
                        </p>
                    </div>
                    <span className="text-2xl">⏳</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Média de Duração / Ramal</span>
                        <p className="text-base font-black text-slate-700 mt-0.5">
                            {mediaHorasVirada ? `⚡ ~${mediaHorasVirada} horas` : 'Aguardando histórico'}
                        </p>
                    </div>
                    <span className="text-2xl">📈</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Estoque Reserva (Oxigênio)</span>
                        <p className="text-base font-black text-blue-600 mt-0.5">
                            {gasOxigenio?.quantidade_atual || 0} Cilindros Cheios
                        </p>
                    </div>
                    <span className="text-2xl">📦</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total de Cilindros Trocados</span>
                        <p className="text-base font-black text-slate-800 mt-0.5">
                            {totalCilindrosConsumidos} Cilindros (Geral)
                        </p>
                    </div>
                    <span className="text-2xl">🔄</span>
                </div>
            </div>

            {/* 🔮 ALERTA PREDITIVO DE PRÓXIMA VIRADA (SAFETY GUARD) */}
            {predicaoVirada && (
                <div className={`mb-6 p-5 rounded-3xl border transition-all shadow-sm no-print ${
                    predicaoVirada.alertaCritico 
                        ? 'bg-rose-50 border-rose-200 text-rose-900 animate-pulse' 
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-900'
                }`}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="space-y-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full inline-block ${
                                predicaoVirada.alertaCritico ? 'bg-rose-200 text-rose-800' : 'bg-blue-200 text-blue-800'
                            }`}>
                                {predicaoVirada.alertaCritico ? '🚨 Alerta: Previsão de Virada Iminente' : '🔮 Previsão Inteligente de Consumo'}
                            </span>
                            <h4 className="text-sm font-black uppercase tracking-tight">
                                Estimativa de Esgotamento do Ramal {manifold?.ramal_ativo}: ~{predicaoVirada.horasRestantes} horas restantes
                            </h4>
                            <p className="text-xs font-medium opacity-80">
                                Próxima virada provável em: <strong>{predicaoVirada.dataEstimada.toLocaleString('pt-BR')}</strong> (baseada no consumo histórico de ~{mediaHorasVirada}h por carga)
                            </p>
                        </div>

                        <div className="w-full md:w-64 bg-white/70 p-3 rounded-2xl border border-white">
                            <div className="flex justify-between text-[10px] font-black uppercase mb-1">
                                <span>Carga Consumida</span>
                                <span>{predicaoVirada.percentualConsumido}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 rounded-full ${
                                        predicaoVirada.alertaCritico ? 'bg-rose-600' : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${predicaoVirada.percentualConsumido}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ABAS */}
            <div className="flex border-b border-slate-200 mb-6 gap-6 no-print">
                <button 
                    onClick={() => setAbaAtiva('manifold')}
                    className={`pb-3 font-black text-xs uppercase tracking-widest transition-all ${abaAtiva === 'manifold' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
                >
                    🚰 Manifold Principal (2x12)
                </button>
                <button 
                    onClick={() => setAbaAtiva('estoque')}
                    className={`pb-3 font-black text-xs uppercase tracking-widest transition-all ${abaAtiva === 'estoque' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
                >
                    📊 Catálogo & Saldo de Gases
                </button>
                <button 
                    onClick={() => setAbaAtiva('historico')}
                    className={`pb-3 font-black text-xs uppercase tracking-widest transition-all ${abaAtiva === 'historico' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}
                >
                    🕒 Livro de Rastreabilidade & Setores
                </button>
            </div>

            {/* ABA 1: MANIFOLD */}
            {abaAtiva === 'manifold' && (
                <div className="space-y-6 no-print">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* RAMAL A */}
                        <div className={`p-6 rounded-3xl border-2 transition-all shadow-sm ${
                            manifold?.ramal_ativo === 'A' 
                                ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200' 
                                : 'bg-white border-slate-200 opacity-90'
                        }`}>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linha Primária</span>
                                    <h3 className="text-xl font-black text-slate-800">RAMAL A (12 Cilindros)</h3>
                                </div>
                                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                                    manifold?.ramal_ativo === 'A' ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {manifold?.ramal_ativo === 'A' ? '● EM OPERAÇÃO (ALIMENTANDO REDE)' : 'STANDBY / CHEIO'}
                                </span>
                            </div>

                            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 my-4 bg-slate-900/5 p-4 rounded-2xl">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <div className={`w-6 h-12 rounded-t-full rounded-b-md flex items-center justify-center text-[9px] font-black text-white shadow-xs ${
                                            manifold?.ramal_ativo === 'A' ? 'bg-emerald-500' : 'bg-blue-500'
                                        }`}>
                                            {i + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="text-xs text-slate-600 font-medium mt-2 flex justify-between items-center">
                                <span>Status: <strong>{manifold?.ramal_ativo === 'A' ? 'Gás fluindo na rede hospitalar' : 'Pronto para assumir na virada'}</strong></span>
                                {manifold?.ramal_ativo === 'A' && (
                                    <span className="font-bold text-emerald-700 font-mono text-[11px] bg-emerald-100/60 px-2 py-0.5 rounded">
                                        ⏱️ {statusTempoRamal.texto} em operação
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* RAMAL B */}
                        <div className={`p-6 rounded-3xl border-2 transition-all shadow-sm ${
                            manifold?.ramal_ativo === 'B' 
                                ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-200' 
                                : 'bg-white border-slate-200 opacity-90'
                        }`}>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Linha Secundária</span>
                                    <h3 className="text-xl font-black text-slate-800">RAMAL B (12 Cilindros)</h3>
                                </div>
                                <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                                    manifold?.ramal_ativo === 'B' ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {manifold?.ramal_ativo === 'B' ? '● EM OPERAÇÃO (ALIMENTANDO REDE)' : 'STANDBY / CHEIO'}
                                </span>
                            </div>

                            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 my-4 bg-slate-900/5 p-4 rounded-2xl">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <div className={`w-6 h-12 rounded-t-full rounded-b-md flex items-center justify-center text-[9px] font-black text-white shadow-xs ${
                                            manifold?.ramal_ativo === 'B' ? 'bg-emerald-500' : 'bg-blue-500'
                                        }`}>
                                            {i + 1}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="text-xs text-slate-600 font-medium mt-2 flex justify-between items-center">
                                <span>Status: <strong>{manifold?.ramal_ativo === 'B' ? 'Gás fluindo na rede hospitalar' : 'Pronto para assumir na virada'}</strong></span>
                                {manifold?.ramal_ativo === 'B' && (
                                    <span className="font-bold text-emerald-700 font-mono text-[11px] bg-emerald-100/60 px-2 py-0.5 rounded">
                                        ⏱️ {statusTempoRamal.texto} em operação
                                    </span>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* DETALHES DA ÚLTIMA VIRADA */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Última Virada Registrada</span>
                            <p className="text-sm font-black text-slate-800 mt-0.5">
                                📅 {manifold?.data_ultima_virada ? new Date(manifold.data_ultima_virada).toLocaleString('pt-BR') : 'Sem registros'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Responsável Técnico: <strong className="text-slate-700">{manifold?.ultimo_tecnico || '---'}</strong>
                            </p>
                        </div>
                        <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-100 text-right">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Saldo de Oxigênio na Central</span>
                            <span className="text-2xl font-black text-blue-600">{gasOxigenio?.quantidade_atual || 0} un. cheias</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 2: ESTOQUE */}
            {abaAtiva === 'estoque' && (
                <div className="space-y-4 no-print">
                    <div className="flex justify-end">
                        <button onClick={() => setModalNovoGas(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm">
                            + Cadastrar Novo Gás
                        </button>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-4">Tipo de Gás Medicinal</th>
                                    <th className="p-4 text-center">Capacidade Unitária</th>
                                    <th className="p-4 text-center">Cilindros Cheios</th>
                                    <th className="p-4 text-center">Volume Total</th>
                                    <th className="p-4">Último Preço / Unidade</th>
                                    <th className="p-4 text-center">Situação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                {gases.map(gas => (
                                    <tr key={gas.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-4 font-black uppercase text-slate-800">{gas.tipo_gas}</td>
                                        <td className="p-4 text-center font-mono">{gas.capacidade_cilindro} m³</td>
                                        <td className="p-4 text-center font-black text-blue-600 text-sm">{gas.quantidade_atual} un.</td>
                                        <td className="p-4 text-center font-bold text-slate-600">{gas.volume_total_m3} m³</td>
                                        <td className="p-4 font-mono font-bold">R$ {Number(gas.valor_ultimo_cilindro || 0).toFixed(2)}</td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                                                gas.alerta_estoque ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-green-100 text-green-700'
                                            }`}>
                                                {gas.alerta_estoque ? '⚠️ Crítico' : '✓ Normal'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ABA 3: HISTÓRICO E RASTREABILIDADE (ALVO DA IMPRESSÃO / AUDITORIA) */}
            {abaAtiva === 'historico' && (
                <div className="gases-print-container space-y-6">
                    
                    {/* CABEÇALHO PARA IMPRESSÃO HOSPITALAR */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:border-b-2 print:border-slate-800 print:rounded-none print:shadow-none print:p-0 print:pb-3">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight print:text-lg">
                                    SEC-H — LIVRO DE REGISTO & RASTREIO DE GASES MEDICINAIS
                                </h1>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5 print:text-[10px]">
                                    Hospital Domingos Lourenço • Engenharia Clínica & Central de Oxigênio
                                </p>
                            </div>
                            <div className="text-left sm:text-right">
                                <span className="text-xs font-mono font-bold text-blue-600 block print:text-[10px] print:text-slate-800">
                                    Data de Emissão: {new Date().toLocaleDateString('pt-BR')}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 block uppercase print:text-[8px]">
                                    {historico.length} {historico.length === 1 ? 'movimentação' : 'movimentações registadas'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* TABELA DO LIVRO */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border-none print:shadow-none">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 print:bg-white print:text-slate-800">
                                    <tr>
                                        <th className="p-4 print:p-2">Data/Hora</th>
                                        <th className="p-4 print:p-2">Operação</th>
                                        <th className="p-4 print:p-2">Gás</th>
                                        <th className="p-4 text-center print:p-2">Qtd.</th>
                                        <th className="p-4 print:p-2">Destino / Origem</th>
                                        <th className="p-4 text-center print:p-2">Duração Carga</th>
                                        <th className="p-4 print:p-2">Responsável</th>
                                        <th className="p-4 print:p-2">Detalhes / Observações</th>
                                        <th className="p-4 text-center no-print">Anexo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700 print:divide-slate-200">
                                    {historico.map(hist => {
                                        const isVirada = hist.observacao?.toUpperCase().includes('VIRADA') || hist.observacao?.toUpperCase().includes('MANIFOLD');
                                        const isEntrada = hist.tipo_movimentacao === 'Entrada';
                                        const horas = Number(hist.tempo_duracao_horas || 0);

                                        const formatarDuracao = (h) => {
                                            if (!h || h <= 0) return null;
                                            const dias = Math.floor(h / 24);
                                            const restoHoras = Math.round(h % 24);
                                            if (dias > 0) return `${dias}d ${restoHoras}h`;
                                            return `${h}h`;
                                        };

                                        return (
                                            <tr key={hist.id} className="hover:bg-slate-50/70 transition-colors gases-card-print print:text-[10px]">
                                                {/* Data e Hora */}
                                                <td className="p-4 font-mono text-slate-500 text-[11px] whitespace-nowrap print:p-2 print:text-[9px]">
                                                    {new Date(hist.data_movimentacao).toLocaleDateString('pt-BR')}<br />
                                                    <span className="text-[10px] text-slate-400 print:text-[8px]">{new Date(hist.data_movimentacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </td>

                                                {/* Tipo de Operação */}
                                                <td className="p-4 whitespace-nowrap print:p-2">
                                                    {isVirada ? (
                                                        <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200 print:border-none print:p-0 print:text-purple-900">
                                                            🔄 Virada Manifold
                                                        </span>
                                                    ) : isEntrada ? (
                                                        <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200 print:border-none print:p-0 print:text-blue-900">
                                                            📥 Entrada / NF
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200 print:border-none print:p-0 print:text-amber-900">
                                                            📤 Saída / Setor
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Nome do Gás */}
                                                <td className="p-4 font-black uppercase text-slate-800 whitespace-nowrap print:p-2">
                                                    {hist.tipo_gas}
                                                </td>

                                                {/* Quantidade */}
                                                <td className="p-4 text-center whitespace-nowrap print:p-2 font-mono font-bold">
                                                    {hist.quantidade_cilindros} un.
                                                </td>

                                                {/* Destino / Setor */}
                                                <td className="p-4 font-bold text-slate-700 uppercase whitespace-nowrap print:p-2 print:text-[9px]">
                                                    {isVirada ? 'Manifold Principal' : hist.setor_nome || (isEntrada ? 'Doca / Recebimento' : 'Central de Gases')}
                                                </td>

                                                {/* Duração da Carga */}
                                                <td className="p-4 text-center whitespace-nowrap print:p-2 font-mono font-bold">
                                                    {horas > 0 ? `⏱️ ${formatarDuracao(horas)}` : '—'}
                                                </td>

                                                {/* Técnico Responsável */}
                                                <td className="p-4 font-bold text-slate-600 whitespace-nowrap print:p-2 print:text-[9px]">
                                                    {hist.tecnico_responsavel}
                                                </td>

                                                {/* Observações / Detalhes */}
                                                <td className="p-4 text-slate-600 max-w-xs print:p-2 print:text-[9px]">
                                                    <p className="line-clamp-2 print:line-clamp-none text-[11px] print:text-[9px] leading-relaxed">
                                                        {hist.observacao || 'Sem observações adicionais.'}
                                                    </p>
                                                </td>

                                                {/* Comprovante (Oculto no Papel) */}
                                                <td className="p-4 text-center whitespace-nowrap no-print">
                                                    {hist.url_comprovante ? (
                                                        <a 
                                                            href={`${BASE_URL}${hist.url_comprovante}`} 
                                                            target="_blank" 
                                                            rel="noreferrer" 
                                                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all border border-blue-200 inline-flex items-center gap-1 shadow-xs"
                                                        >
                                                            <span>📄</span> Ver Anexo
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-300 text-xs">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {historico.length === 0 && (
                                        <tr>
                                            <td colSpan="9" className="text-center py-12 text-slate-400 font-bold uppercase text-xs">
                                                Nenhum registo de movimentação encontrado até o momento.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* RODAPÉ DE AUDITORIA & ASSINATURA TÉCNICA */}
                    <div className="hidden print:block mt-12 pt-6 border-t border-slate-300 text-center text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                        <div className="flex justify-between items-center mb-8 px-12 pt-8">
                            <div className="text-center w-64 border-t border-slate-800 pt-1">
                                <p className="text-[10px] font-black text-slate-900">PLANTONISTA / ENGENHARIA CLÍNICA</p>
                                <p className="text-[8px] text-slate-500">Assinatura do Responsável</p>
                            </div>
                            <div className="text-center w-64 border-t border-slate-800 pt-1">
                                <p className="text-[10px] font-black text-slate-900">SUPERVISÃO TÉCNICA HOSPITALAR</p>
                                <p className="text-[8px] text-slate-500">Conferência / Ciente</p>
                            </div>
                        </div>
                        Registo emitido pelo sistema SEC-H Engenharia Clínica em {new Date().toLocaleString('pt-BR')} • Livro Oficial de Gases Medicinais
                    </div>

                </div>
            )}

            {/* --- MODAL 1: VIRADA DO MANIFOLD (COM CAMPOS DE PRESSÃO) --- */}
            {modalViradaManifold && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-red-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🔄 Virada de Manifold (Troca dos 12 Cilindros)</span>
                            <button onClick={() => setModalViradaManifold(false)} className="text-lg">✕</button>
                        </div>
                        <form onSubmit={handleViradaManifold} className="p-6 space-y-4">
                            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                                <p className="font-black uppercase">Procedimento Operacional:</p>
                                <p>O <strong>Ramal {manifold?.ramal_ativo}</strong> está esgotado.</p>
                                <p>O <strong>Ramal {manifold?.ramal_ativo === 'A' ? 'B' : 'A'}</strong> assumirá o fornecimento hospitalar.</p>
                                <p>Serão deduzidos <strong>12 cilindros de Oxigênio</strong> do estoque para recarregar o ramal vazio.</p>
                            </div>

                            {/* Campos Estruturados de Pressão de Rede e Cilindros */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Pressão de Rede (bar) *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="Ex: 4.5"
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold font-mono bg-slate-50 outline-none focus:bg-white text-slate-800 text-center"
                                        value={dadosVirada.pressao_rede_bar}
                                        onChange={e => setDadosVirada({ ...dadosVirada, pressao_rede_bar: e.target.value })}
                                    />
                                    <span className="text-[9px] text-slate-400 mt-0.5 block">Alvo normativo: 4,0 a 5,0 bar</span>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Pressão Cilindros Cheios (bar) *</label>
                                    <input 
                                        type="text"
                                        required
                                        placeholder="Ex: 150"
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold font-mono bg-slate-50 outline-none focus:bg-white text-slate-800 text-center"
                                        value={dadosVirada.pressao_cilindros_bar}
                                        onChange={e => setDadosVirada({ ...dadosVirada, pressao_cilindros_bar: e.target.value })}
                                    />
                                    <span className="text-[9px] text-slate-400 mt-0.5 block">Mínimo entrada: 150 bar</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Observações da Virada / Ocorrências</label>
                                <textarea 
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none resize-none focus:bg-white text-slate-800"
                                    rows="2"
                                    placeholder="Ex: Válvula reguladora operando sem fugas sonoras."
                                    value={dadosVirada.observacao}
                                    onChange={e => setDadosVirada({ ...dadosVirada, observacao: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModalViradaManifold(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition-all">Confirmar Virada</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: ENVIO DE CILINDROS PARA SETOR HOSPITALAR --- */}
            {modalEnvioSetor && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-indigo-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🏥 Envio de Cilindro para Setor Hospitalar</span>
                            <button onClick={() => setModalEnvioSetor(false)} className="text-lg">✕</button>
                        </div>
                        <form onSubmit={handleRegistrarEnvioSetor} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Gás Medicinal *</label>
                                <select 
                                    required 
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-800"
                                    value={formEnvio.tipo_gas_id}
                                    onChange={e => setFormEnvio({ ...formEnvio, tipo_gas_id: e.target.value })}
                                >
                                    <option value="">Selecione o Gás...</option>
                                    {gases.map(g => (
                                        <option key={g.id} value={g.id}>{g.tipo_gas} (Disponível: {g.quantidade_atual} un.)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Setor de Destino *</label>
                                    <select 
                                        required 
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-800"
                                        value={formEnvio.setor_destino_id}
                                        onChange={e => setFormEnvio({ ...formEnvio, setor_destino_id: e.target.value })}
                                    >
                                        <option value="">Selecione o Setor...</option>
                                        {setores.map(s => (
                                            <option key={s.id} value={s.id}>{s.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Qtd. Cilindros *</label>
                                    <input 
                                        type="number" min="1" required
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-center text-slate-800"
                                        value={formEnvio.quantidade_cilindros}
                                        onChange={e => setFormEnvio({ ...formEnvio, quantidade_cilindros: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Finalidade / Observação (Opcional)</label>
                                <textarea 
                                    placeholder="Ex: Cilindro de Takeo para carrinho de anestesia no Centro Cirúrgico."
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none text-slate-800 h-20"
                                    value={formEnvio.observacao}
                                    onChange={e => setFormEnvio({ ...formEnvio, observacao: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModalEnvioSetor(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition-all">Registrar Entrega</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 3: ENTRADA / COMPRA COM SELEÇÃO DE FORNECEDOR --- */}
            {modalCompra && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="bg-blue-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🛒 Entrada de Cilindros & Anexo de Canhoto</span>
                            <button onClick={() => setModalCompra(false)} className="text-lg">✕</button>
                        </div>
                        <form onSubmit={handleRegistrarCompra} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tipo de Gás Recebido *</label>
                                <select 
                                    required 
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-800"
                                    value={formCompra.tipo_gas_id}
                                    onChange={e => setFormCompra({ ...formCompra, tipo_gas_id: e.target.value })}
                                >
                                    <option value="">Selecione o Gás...</option>
                                    {gases.map(g => (
                                        <option key={g.id} value={g.id}>{g.tipo_gas} ({g.capacidade_cilindro} m³)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Qtd. Cilindros Cheios *</label>
                                    <input 
                                        type="number" min="1" required 
                                        placeholder="Ex: 12"
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-center text-slate-800"
                                        value={formCompra.quantidade_cilindros}
                                        onChange={e => setFormCompra({ ...formCompra, quantidade_cilindros: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Valor Unitário (R$)</label>
                                    <input 
                                        type="text" 
                                        placeholder="0,00"
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-center text-slate-800"
                                        value={formCompra.valor_unitario_cilindro}
                                        onChange={e => setFormCompra({ ...formCompra, valor_unitario_cilindro: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nº Nota Fiscal / Canhoto</label>
                                    <input 
                                        type="text"
                                        placeholder="Ex: 0582136"
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-800"
                                        value={formCompra.numero_nf}
                                        onChange={e => setFormCompra({ ...formCompra, numero_nf: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fornecedor Homologado</label>
                                    <select
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-800"
                                        value={formCompra.fornecedor_id}
                                        onChange={e => {
                                            const forn = fornecedores.find(f => String(f.id) === String(e.target.value));
                                            setFormCompra({ 
                                                ...formCompra, 
                                                fornecedor_id: e.target.value,
                                                fornecedor_nome: forn ? (forn.nome_fantasia || forn.razao_social) : ''
                                            });
                                        }}
                                    >
                                        <option value="">Selecione o Fornecedor...</option>
                                        {fornecedores.map(f => (
                                            <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Canhoto Assinado / NF (Foto ou PDF)</label>
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf"
                                    className="text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-800 file:text-white"
                                    onChange={e => setComprovanteCompra(e.target.files[0])}
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Observações Adicionais (Lote, Validade...)</label>
                                <input 
                                    type="text"
                                    placeholder="Ex: Lote 403, lacres conferidos na doca."
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-slate-800"
                                    value={formCompra.observacao}
                                    onChange={e => setFormCompra({ ...formCompra, observacao: e.target.value })}
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModalCompra(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase shadow-md transition-all">Registrar Entrada</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 4: NOVO TIPO DE GÁS --- */}
            {modalNovoGas && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="font-black text-slate-800 text-lg uppercase mb-4">🧪 Cadastrar Novo Tipo de Gás</h2>
                        <form onSubmit={handleCadastrarGas} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Gás</label>
                                <input type="text" placeholder="Ex: Gás Takeo / Óxido Nitroso" required className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none" value={formNovoGas.tipo_gas} onChange={e => setFormNovoGas({...formNovoGas, tipo_gas: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Capacidade (m³)</label>
                                    <input type="number" step="0.1" placeholder="Ex: 10" required className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none" value={formNovoGas.capacidade_cilindro} onChange={e => setFormNovoGas({...formNovoGas, capacidade_cilindro: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Estoque Mínimo</label>
                                    <input type="number" placeholder="Ex: 5" required className="w-full border-2 border-slate-100 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none" value={formNovoGas.estoque_minimo} onChange={e => setFormNovoGas({...formNovoGas, estoque_minimo: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setModalNovoGas(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Gases;