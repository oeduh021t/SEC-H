import { useEffect, useState } from 'react';

const Gases = () => {
    const [gases, setGases] = useState([]);
    const [setores, setSetores] = useState([]);
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
    const [formCompra, setFormCompra] = useState({ tipo_gas_id: '', quantidade_cilindros: '', valor_unitario_cilindro: '', observacao: '' });
    const [comprovanteCompra, setComprovanteCompra] = useState(null);
    
    // Formulário de Envio Setorial Simplificado por Quantidade
    const [formEnvio, setFormEnvio] = useState({ 
        tipo_gas_id: '', 
        quantidade_cilindros: 1, 
        setor_destino_id: '', 
        observacao: '' 
    });
    
    const [obsVirada, setObsVirada] = useState('');

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
            const [resGases, resHist, resManifold, resSetores] = await Promise.all([
                fetch(`${API_URL}/gases`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/gases/historico`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/gases/manifold`, { headers }).then(r => r.json()),
                fetch(`${API_URL}/setores`, { headers }).then(r => r.json())
            ]);

            setGases(Array.isArray(resGases) ? resGases : []);
            setHistorico(Array.isArray(resHist) ? resHist : []);
            setManifold(resManifold);
            setSetores(Array.isArray(resSetores) ? resSetores : []);
        } catch (err) {
            console.error("Erro ao carregar central de gases:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    // ⏱️ CÁLCULO DINÂMICO DE TEMPO DE CONSUMO DO RAMAL EM USO
    const calcularTempoEmUso = (dataUltimaViradaStr) => {
        if (!dataUltimaViradaStr) return 'Recém instalado';
        const inicio = new Date(dataUltimaViradaStr);
        const diffMs = Math.max(0, agora - inicio);
        const minutosTotais = Math.floor(diffMs / (1000 * 60));
        const dias = Math.floor(minutosTotais / 1440);
        const horas = Math.floor((minutosTotais % 1440) / 60);
        const minutos = minutosTotais % 60;

        if (dias > 0) return `${dias}d ${horas}h ${minutos}m em operação`;
        if (horas > 0) return `${horas}h ${minutos}m em operação`;
        return `${minutos} minutos em operação`;
    };

    // Handlers
    const handleViradaManifold = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/gases/manifold/virada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify({
                    ramal_que_esvaziou: manifold?.ramal_ativo || 'A',
                    tecnico_nome: user.nome,
                    observacao: obsVirada
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`✅ ${data.message}`);
                setModalViradaManifold(false);
                setObsVirada('');
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
        const formData = new FormData();
        formData.append('tipo_gas_id', formCompra.tipo_gas_id);
        formData.append('quantidade_cilindros', formCompra.quantidade_cilindros);
        formData.append('valor_unitario_cilindro', formCompra.valor_unitario_cilindro);
        formData.append('observacao', formCompra.observacao);
        formData.append('tecnico_nome', user.nome);
        if (comprovanteCompra) formData.append('comprovante_pdf', comprovanteCompra);

        try {
            const res = await fetch(`${API_URL}/gases/entrada`, {
                method: 'POST',
                headers: { 'x-usuario-nivel': nivel },
                body: formData
            });
            if (res.ok) {
                alert("Compra e canhoto registrados com sucesso! 🛒📄");
                setModalCompra(false);
                setFormCompra({ tipo_gas_id: '', quantidade_cilindros: '', valor_unitario_cilindro: '', observacao: '' });
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
                alert("Novo gás adicionado com sucesso!");
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
            
            {/* CABEÇALHO */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
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
                </div>
            </div>

            {/* CARDS DE INDICADORES RÁPIDOS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Tempo do Ramal Ativo</span>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">
                            ⏱️ {calcularTempoEmUso(manifold?.data_ultima_virada)}
                        </p>
                    </div>
                    <span className="text-2xl">⏳</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Estoque Reserva de Oxigênio</span>
                        <p className="text-xl font-black text-blue-600 mt-0.5">
                            {gasOxigenio?.quantidade_atual || 0} Cilindros Cheios
                        </p>
                    </div>
                    <span className="text-2xl">📦</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Total de Cilindros Trocados</span>
                        <p className="text-xl font-black text-slate-800 mt-0.5">
                            {totalCilindrosConsumidos} Cilindros (Geral)
                        </p>
                    </div>
                    <span className="text-2xl">🔄</span>
                </div>
            </div>

            {/* ABAS */}
            <div className="flex border-b border-slate-200 mb-6 gap-6">
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
                <div className="space-y-6">
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
                                        ⏱️ {calcularTempoEmUso(manifold?.data_ultima_virada)}
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
                                        ⏱️ {calcularTempoEmUso(manifold?.data_ultima_virada)}
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
                <div className="space-y-4">
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

            {/* ABA 3: HISTÓRICO E RASTREABILIDADE */}
            {abaAtiva === 'historico' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-4">Data/Hora</th>
                                    <th className="p-4">Gás</th>
                                    <th className="p-4">Operação</th>
                                    <th className="p-4 text-center">Qtd.</th>
                                    <th className="p-4">Setor Destino</th>
                                    <th className="p-4">Técnico</th>
                                    <th className="p-4">Duração Carga</th>
                                    <th className="p-4">Observações</th>
                                    <th className="p-4 text-center">Anexo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                {historico.map(hist => (
                                    <tr key={hist.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                                            {new Date(hist.data_movimentacao).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-4 font-black uppercase text-slate-800">{hist.tipo_gas}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                hist.tipo_movimentacao === 'Entrada' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {hist.tipo_movimentacao === 'Entrada' ? 'Entrada' : 'Saída'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center font-black text-slate-800">{hist.quantidade_cilindros} un.</td>
                                        <td className="p-4 font-bold text-blue-600 uppercase">
                                            {hist.setor_nome || (hist.observacao?.includes('MANIFOLD') ? 'Manifold Central' : 'Central de Gases')}
                                        </td>
                                        <td className="p-4 font-bold text-slate-600">{hist.tecnico_responsavel}</td>
                                        <td className="p-4 font-mono font-bold text-emerald-600">
                                            {hist.tempo_duracao_horas ? `⏱️ ${hist.tempo_duracao_horas}h` : '---'}
                                        </td>
                                        <td className="p-4 text-slate-500 max-w-xs truncate" title={hist.observacao}>{hist.observacao}</td>
                                        <td className="p-4 text-center">
                                            {hist.url_comprovante ? (
                                                <a 
                                                    href={`${BASE_URL}${hist.url_comprovante}`} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all border border-blue-100"
                                                >
                                                    📄 Canhoto
                                                </a>
                                            ) : (
                                                <span className="text-slate-300 text-xs">---</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- MODAL 1: VIRADA DO MANIFOLD (12 CILINDROS) --- */}
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
                                <p>• O <strong>Ramal {manifold?.ramal_ativo}</strong> está esgotado.</p>
                                <p>• O <strong>Ramal {manifold?.ramal_ativo === 'A' ? 'B' : 'A'}</strong> assumirá o fornecimento hospitalar.</p>
                                <p>• Serão deduzidos <strong>12 cilindros de Oxigênio</strong> do estoque para recarregar o ramal vazio.</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Observações da Virada / Pressão</label>
                                <textarea 
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none resize-none focus:bg-white text-slate-800"
                                    rows="3"
                                    placeholder="Ex: Virada automática efetuada. Pressão estabilizada em 4.5 bar."
                                    value={obsVirada}
                                    onChange={e => setObsVirada(e.target.value)}
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

            {/* --- MODAL 2: ENVIO DE CILINDROS PARA SETOR (TAKEO / CENTRO CIRÚRGICO / UTI / ENFERMARIAS) --- */}
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

            {/* --- MODAL 3: ENTRADA / COMPRA COM CANHOTO --- */}
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
                                        type="number" step="0.01" 
                                        placeholder="0.00"
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none text-center text-slate-800"
                                        value={formCompra.valor_unitario_cilindro}
                                        onChange={e => setFormCompra({ ...formCompra, valor_unitario_cilindro: e.target.value })}
                                    />
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
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nº da NF / Fornecedor / Lote</label>
                                <input 
                                    type="text"
                                    placeholder="Ex: NF 0582136 - Air Liquide"
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