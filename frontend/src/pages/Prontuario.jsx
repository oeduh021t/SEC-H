import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const Prontuario = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [dados, setDados] = useState(null);
    const [erroAutenticacao, setErroAutenticacao] = useState(false);
    const [imagemModal, setImagemModal] = useState(null);
    const [filtroTimeline, setFiltroTimeline] = useState('todos');
    
    // 🚚 ESTADOS PARA SAÍDA DE MANUTENÇÃO EXTERNA
    const [modalSaidaExterna, setModalSaidaExterna] = useState(false);
    const [fornecedores, setFornecedores] = useState([]);
    const [fornecedorId, setFornecedorId] = useState('');
    const [descricaoMotivo, setDescricaoMotivo] = useState('');
    const [previsaoRetorno, setPrevisaoRetorno] = useState('');
    const [enviandoSaida, setEnviandoSaida] = useState(false);
    const [guiaImpressao, setGuiaImpressao] = useState(null);

    // 🛬 ESTADOS PARA RETORNO DE MANUTENÇÃO EXTERNA
    const [modalRetorno, setModalRetorno] = useState(false);
    const [numeroNF, setNumeroNF] = useState('');
    const [valorServico, setValorServico] = useState('');
    const [observacaoRetorno, setObservacaoRetorno] = useState('');
    const [arquivoLaudo, setArquivoLaudo] = useState(null);
    const [enviandoRetorno, setEnviandoRetorno] = useState(false);

    // ⚙️ ESTADOS PARA EDIÇÃO DO ATIVO
    const [modalEditarEquip, setModalEditarEquip] = useState(false);
    const [setores, setSetores] = useState([]);
    const [tiposEquipamentos, setTiposEquipamentos] = useState([]);
    const [novaFotoEquip, setNovaFotoEquip] = useState(null);
    const [salvandoEdicao, setSalvandoEdicao] = useState(false);
    const [formEquip, setFormEquip] = useState({
        nome: '',
        modelo: '',
        patrimonio: '',
        num_serie: '',
        fabricante: '',
        setor_id: '',
        status: 'Ativo',
        tipo_id: '',
        periodicidade_preventiva: 0,
        data_ultima_preventiva: '',
        valor: 0
    });

    // 🖨️ CONTROLE DE MODO DE IMPRESSÃO
    const [modoImpressao, setModoImpressao] = useState('prontuario');

    const API_URL = '/api';
    const BASE_URL = ''; 

    const obterUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser) : null;
    };

    const user = obterUsuario();
    const isAdminOuCoord = ['admin', 'coordenador'].includes(user?.nivel?.toLowerCase().trim());

    // 🛡️ FORMATAÇÃO SEGURA DE DATA (EVITA O BUG DO FUSO HORÁRIO)
    const formatarDataSegura = (dataStr) => {
        if (!dataStr) return 'Pendente';
        const dataPura = String(dataStr).split('T')[0];
        const partes = dataPura.split('-');
        if (partes.length !== 3) return dataStr;
        const [ano, mes, dia] = partes;
        return `${dia}/${mes}/${ano}`;
    };

    const formatarDataHoraSegura = (dataStr) => {
        if (!dataStr) return '---';
        const [dataPart, horaPart] = String(dataStr).replace('T', ' ').split(' ');
        const dataFormatada = formatarDataSegura(dataPart);
        if (horaPart) {
            return `${dataFormatada} às ${horaPart.substring(0, 5)}`;
        }
        return dataFormatada;
    };

    const gerarLinkQRCodeLocal = (equipId) => {
        const urlDestino = `${window.location.origin}/prontuario/${equipId}`;
        return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlDestino)}`;
    };

    const carregarProntuario = () => {
        const nivel = user ? user.nivel : '';

        fetch(`${API_URL}/equipamentos/${id}/prontuario`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-usuario-nivel': nivel
            }
        })
            .then(res => {
                if (res.status === 401 || res.status === 403) {
                    setErroAutenticacao(true);
                    throw new Error("Não autorizado");
                }
                return res.json();
            })
            .then(data => {
                if (data) setDados(data);
            })
            .catch(err => console.error("Erro ao carregar prontuário:", err));
    };

    useEffect(() => {
        carregarProntuario();
        
        const nivel = user?.nivel || '';
        fetch(`${API_URL}/fornecedores`, { headers: { 'x-usuario-nivel': nivel } })
            .then(res => res.json())
            .then(data => setFornecedores(data || []))
            .catch(err => console.error("Erro ao carregar fornecedores:", err));

        fetch(`${API_URL}/setores`, { headers: { 'x-usuario-nivel': nivel } })
            .then(res => res.json())
            .then(data => setSetores(data || []))
            .catch(err => console.error("Erro ao carregar setores:", err));

        fetch(`${API_URL}/tipos-equipamentos`, { headers: { 'x-usuario-nivel': nivel } })
            .then(res => res.json())
            .then(data => setTiposEquipamentos(data || []))
            .catch(err => console.error("Erro ao carregar tipos de equipamentos:", err));
    }, [id]);

    const handleAbrirModalEdicao = () => {
        if (!dados || !dados.dados) return;
        const eq = dados.dados;

        setFormEquip({
            nome: eq.nome || '',
            modelo: eq.modelo || '',
            patrimonio: eq.patrimonio || '',
            num_serie: eq.num_serie || '',
            fabricante: eq.fabricante || '',
            setor_id: eq.setor_id || '',
            status: eq.status || 'Ativo',
            tipo_id: eq.tipo_id || '',
            periodicidade_preventiva: eq.periodicidade_preventiva || 0,
            data_ultima_preventiva: eq.data_ultima_preventiva ? eq.data_ultima_preventiva.split('T')[0] : '',
            valor: eq.valor || 0
        });
        setNovaFotoEquip(null);
        setModalEditarEquip(true);
    };

    const handleSalvarEdicaoAtivo = async (e) => {
        e.preventDefault();
        setSalvandoEdicao(true);

        const formData = new FormData();
        formData.append('nome', formEquip.nome);
        formData.append('modelo', formEquip.modelo);
        formData.append('patrimonio', formEquip.patrimonio);
        formData.append('num_serie', formEquip.num_serie);
        formData.append('fabricante', formEquip.fabricante);
        formData.append('setor_id', formEquip.setor_id || '');
        formData.append('status', formEquip.status);
        formData.append('tipo_id', formEquip.tipo_id || '');
        formData.append('periodicidade_preventiva', formEquip.periodicidade_preventiva || 0);
        formData.append('data_ultima_preventiva', formEquip.data_ultima_preventiva || '');
        formData.append('valor', formEquip.valor || 0);

        if (novaFotoEquip) {
            formData.append('foto_equipamento', novaFotoEquip);
        }

        try {
            const res = await fetch(`${API_URL}/equipamentos/${id}`, {
                method: 'PUT',
                headers: {
                    'x-usuario-nivel': user?.nivel || ''
                },
                body: formData
            });

            if (res.ok) {
                alert("Dados do ativo atualizados com sucesso! ⚙️✅");
                setModalEditarEquip(false);
                carregarProntuario();
            } else {
                const errData = await res.json();
                alert(errData.error || "Erro ao atualizar dados do ativo.");
            }
        } catch (err) {
            console.error("Erro na atualização do ativo:", err);
            alert("Erro de conexão ao salvar alterações.");
        } finally {
            setSalvandoEdicao(false);
        }
    };

    const handleCriarChamadoContextualizado = () => {
        if (!dados || !dados.dados) return;
        
        navigate('/chamados', {
            state: {
                equipamento_id: dados.dados.id,
                setor_id: dados.dados.setor_id,
                pre_configurado: true
            }
        });
    };

    const handleImprimirFicha = () => {
        setModoImpressao('prontuario');
        setTimeout(() => window.print(), 150);
    };

    const handleImprimirGuiaSaida = () => {
        if (!guiaImpressao) {
            alert("Nenhuma guia de saída foi gerada recentemente nesta sessão.");
            return;
        }
        setModoImpressao('guia');
        setTimeout(() => window.print(), 150);
    };

    const handleConfirmarSaidaExterna = async (e) => {
        e.preventDefault();
        if (!fornecedorId || !descricaoMotivo) {
            alert("Selecione o fornecedor e informe o motivo da saída.");
            return;
        }

        setEnviandoSaida(true);

        try {
            const response = await fetch(`${API_URL}/equipamentos/${id}/saida-externa`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-usuario-nivel': user?.nivel || ''
                },
                body: JSON.stringify({
                    fornecedor_id: fornecedorId,
                    tecnico_nome: user?.nome || 'Técnico de Plantão',
                    descricao_motivo: descricaoMotivo,
                    data_previsao_retorno: previsaoRetorno || null
                })
            });

            const result = await response.json();

            if (response.ok) {
                const fornSelecionado = fornecedores.find(f => String(f.id) === String(fornecedorId));
                
                const objetoGuia = {
                    equipamento: dados.dados,
                    fornecedor: fornSelecionado,
                    motivo: descricaoMotivo,
                    previsao: previsaoRetorno,
                    dataSaida: new Date().toLocaleDateString('pt-BR')
                };

                setGuiaImpressao(objetoGuia);
                setModalSaidaExterna(false);
                setDescricaoMotivo('');
                setPrevisaoRetorno('');
                carregarProntuario();

                setModoImpressao('guia');
                setTimeout(() => window.print(), 300);

            } else {
                alert("❌ " + (result.error || "Erro ao processar saída externa."));
            }
        } catch (err) {
            alert("❌ Erro de conexão ao tentar registrar saída.");
        } finally {
            setEnviandoSaida(false);
        }
    };

    const handleConfirmarRetorno = async (e) => {
        e.preventDefault();
        setEnviandoRetorno(true);

        const formData = new FormData();
        formData.append('numero_nf', numeroNF);
        formData.append('valor_servico', valorServico || 0);
        formData.append('observacao', observacaoRetorno);
        formData.append('tecnico_nome', user?.nome || 'Técnico de Recebimento');
        if (arquivoLaudo) {
            formData.append('laudo_tecnico', arquivoLaudo);
        }

        try {
            const response = await fetch(`${API_URL}/equipamentos/${id}/retorno-externo`, {
                method: 'POST',
                headers: {
                    'x-usuario-nivel': user?.nivel || ''
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                alert("✅ Retorno registrado com sucesso! O equipamento foi reativado.");
                setModalRetorno(false);
                setNumeroNF('');
                setValorServico('');
                setObservacaoRetorno('');
                setArquivoLaudo(null);
                carregarProntuario();
            } else {
                alert("❌ " + (result.error || "Erro ao registrar retorno do equipamento."));
            }
        } catch (err) {
            alert("❌ Erro de conexão ao processar retorno.");
        } finally {
            setEnviandoRetorno(false);
        }
    };

    const isImagem = (url) => {
        if (!url) return false;
        const ext = url.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
    };

    if (erroAutenticacao) {
        return (
            <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">
                Acesso Negado: Seu perfil não possui privilégios para visualizar o prontuário.
            </div>
        );
    }

    if (!dados || !dados.dados) {
        return <div className="p-10 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse text-center">Carregando prontuário técnico...</div>;
    }

    const equip = dados.dados;
    const timelineFiltrada = (dados.timeline || []).filter(item => {
        if (filtroTimeline === 'todos') return true;
        if (filtroTimeline === 'os') return item.tipo?.toLowerCase().includes('abertura') || item.tipo?.toLowerCase().includes('intervenção');
        if (filtroTimeline === 'preventiva') return item.tipo?.toLowerCase().includes('preventiva') || item.tipo?.toLowerCase().includes('planejada');
        if (filtroTimeline === 'movimentacao') return item.tipo?.toLowerCase().includes('movimentação') || item.tipo?.toLowerCase().includes('saída') || item.tipo?.toLowerCase().includes('retorno');
        return true;
    });

    const totalChamados = (dados.timeline || []).filter(t => t.tipo?.toLowerCase().includes('abertura')).length;
    const totalPreventivas = (dados.timeline || []).filter(t => t.tipo?.toLowerCase().includes('preventiva')).length;

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* CSS DE IMPRESSÃO */}
            <style>{`
                @media print {
                    body * { 
                        visibility: hidden !important; 
                        background: white !important; 
                    }
                    .hide-print { 
                        display: none !important; 
                    }
                    
                    ${modoImpressao === 'prontuario' ? `
                        .relatorio-container, .relatorio-container * { 
                            visibility: visible !important; 
                        }
                        .relatorio-container { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important; 
                            padding: 0 !important;
                            margin: 0 !important; 
                        }
                        #guia-saida-impressao { display: none !important; }
                    ` : ''}

                    ${modoImpressao === 'guia' ? `
                        #guia-saida-impressao, #guia-saida-impressao * { 
                            visibility: visible !important; 
                        }
                        #guia-saida-impressao { 
                            display: block !important;
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important; 
                            padding: 10px !important;
                            margin: 0 !important; 
                        }
                        .relatorio-container { display: none !important; }
                    ` : ''}

                    .impressao-grid {
                        display: grid !important;
                        grid-template-columns: 4fr 8fr !important;
                        gap: 20px !important;
                    }
                    @page { size: A4; margin: 10mm; }
                }
            `}</style>

            {/* BARRA DE AÇÕES SUPERIOR */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-white p-5 rounded-3xl shadow-sm border border-slate-100 hide-print">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate('/equipamentos')} 
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-1 active:scale-95"
                    >
                        ← Voltar
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-blue-600 text-white font-black text-xs px-2.5 py-0.5 rounded-md">
                                PAT: {equip.patrimonio || 'S/P'}
                            </span>
                            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight truncate max-w-lg">
                                {equip.nome}
                            </h1>
                        </div>
                        <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
                            📍 {equip.setor_nome || 'Setor não definido'} • {equip.fabricante || 'Fabricante não informado'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                    {isAdminOuCoord && (
                        <button
                            type="button"
                            onClick={handleAbrirModalEdicao}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                            title="Editar dados cadastrais deste ativo"
                        >
                            <span>⚙️</span> Editar Ativo
                        </button>
                    )}

                    <button 
                        type="button"
                        onClick={handleImprimirFicha}
                        className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                    >
                        🖨️ Imprimir Ficha
                    </button>

                    {guiaImpressao && (
                        <button 
                            type="button"
                            onClick={handleImprimirGuiaSaida}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                        >
                            🖨️ Guia de Saída
                        </button>
                    )}
                    
                    {equip.status === 'Em Manutenção' ? (
                        <button 
                            type="button"
                            onClick={() => setModalRetorno(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all active:scale-95 shadow-md shadow-emerald-100 flex items-center gap-1.5"
                        >
                            🛬 Retorno de Manutenção
                        </button>
                    ) : (
                        <button 
                            type="button"
                            onClick={() => setModalSaidaExterna(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all active:scale-95 shadow-md shadow-indigo-100 flex items-center gap-1.5"
                        >
                            🚚 Saída Externa
                        </button>
                    )}

                    <button 
                        type="button"
                        onClick={handleCriarChamadoContextualizado}
                        className="bg-amber-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase hover:bg-amber-600 transition-all active:scale-95 shadow-md shadow-amber-100 flex items-center gap-1.5"
                    >
                        <span>🚨</span> Abrir OS
                    </button>
                </div>
            </div>

            {/* CONTAINER PRINCIPAL DO PRONTUÁRIO */}
            <div className="relatorio-container space-y-6">

                {/* CABEÇALHO IMPRESSÃO PRONTUÁRIO */}
                <div className="hidden print:block bg-white p-4 border-b-2 border-slate-900 mb-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-base font-black text-slate-900 uppercase">HOSPITAL DOMINGOS LOURENÇO — ENGENHARIA CLÍNICA</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Prontuário Técnico e Histórico de Manutenções do Ativo</p>
                        </div>
                        <div className="text-right text-[9px] text-slate-500 font-mono">
                            Emissão: {new Date().toLocaleString('pt-BR')}
                        </div>
                    </div>
                </div>

                {/* CARDS DE RESUMO OPERACIONAL (DASHBOARD DO ATIVO) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 hide-print">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Status Operacional</span>
                        <div className="mt-1">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider inline-block ${
                                equip.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                                equip.status === 'Em Manutenção' ? 'bg-red-100 text-red-700' :
                                equip.status === 'Reserva' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                                ● {equip.status || 'Ativo'}
                            </span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Histórico de OSs</span>
                        <p className="text-lg font-black text-slate-800 mt-0.5">{totalChamados} Chamados</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Preventivas Realizadas</span>
                        <p className="text-lg font-black text-blue-600 mt-0.5">{totalPreventivas} Rotinas</p>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Custo Total Acumulado</span>
                        <p className="text-lg font-black text-emerald-600 mt-0.5">
                            R$ {Number(dados.custoAcumulado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 impressao-grid">
                    
                    {/* COLUNA ESQUERDA: FICHA TÉCNICA E QR CODE */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border print:border-slate-200">
                            <div className="p-6 text-center">
                                
                                <div className="bg-slate-50 w-full h-48 rounded-2xl mb-4 flex items-center justify-center text-slate-300 overflow-hidden border border-slate-200">
                                    {equip.foto_equipamento ? (
                                        <img 
                                            src={`${BASE_URL}${equip.foto_equipamento}`} 
                                            alt={equip.nome}
                                            className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => setImagemModal(`${BASE_URL}${equip.foto_equipamento}`)}
                                        />
                                    ) : (
                                        <span className="text-5xl">📷</span>
                                    )}
                                </div>

                                <h2 className="font-black text-slate-800 text-xl uppercase leading-tight">{equip.nome}</h2>
                                <p className="text-slate-400 font-bold text-[11px] mt-1 tracking-widest uppercase">{equip.modelo || 'Modelo não cadastrado'}</p>
                            </div>

                            <div className="border-t border-slate-100 p-5 space-y-3 bg-slate-50/50 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Localização:</span>
                                    <span className="text-blue-600 font-black uppercase">{equip.setor_nome || 'Sem Setor'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Patrimônio:</span>
                                    <span className="font-mono font-bold text-slate-700">{equip.patrimonio || 'S/P'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Nº de Série:</span>
                                    <span className="font-mono font-bold text-slate-700">{equip.num_serie || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Fabricante:</span>
                                    <span className="font-bold text-slate-700">{equip.fabricante || 'Não informado'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Valor Inicial de Compra:</span>
                                    <span className="font-mono font-bold text-slate-700">R$ {Number(equip.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Ciclo PMOC:</span>
                                    <span className="font-bold text-slate-700">{equip.periodicidade_preventiva ? `${equip.periodicidade_preventiva} dias` : 'Não configurado'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Última Preventiva:</span>
                                    <span className="font-bold text-slate-700">{formatarDataSegura(equip.data_ultima_preventiva)}</span>
                                </div>

                                <div className="p-3.5 bg-red-50 rounded-2xl border border-red-100 mt-4 print:bg-none print:border-slate-200">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-red-500 font-black text-[9px] uppercase block tracking-wider print:text-slate-600">Custo Total Acumulado</span>
                                            <span className="text-[8px] text-red-400 font-bold block print:text-slate-400">(Aquisição + Peças + Serviços)</span>
                                        </div>
                                        <span className="text-red-600 font-black text-base font-mono print:text-slate-900">
                                            R$ {Number(dados.custoAcumulado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* QR CODE DO ATIVO */}
                                <div className="mt-4 pt-4 border-t border-slate-200 text-center hide-print">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">QR Code de Rastreio Rápido</span>
                                    <img 
                                        src={gerarLinkQRCodeLocal(equip.id)} 
                                        alt="QR Code" 
                                        className="w-28 h-28 mx-auto p-1 bg-white border border-slate-200 rounded-2xl shadow-sm"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-1 font-mono">ID #{equip.id}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DIREITA: LINHA DO TEMPO & CRONOLOGIA VERTICAL */}
                    <div className="lg:col-span-8 space-y-4">
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 print:border print:border-slate-200">
                            
                            {/* CABEÇALHO DO FEED COM FILTROS */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-3">
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                                        <span>🕒</span> Linha do Tempo e Intervenções
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                        {timelineFiltrada.length} evento(s) listados
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-1.5 hide-print">
                                    <button 
                                        type="button" 
                                        onClick={() => setFiltroTimeline('todos')}
                                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all ${filtroTimeline === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        Todos
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFiltroTimeline('os')}
                                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all ${filtroTimeline === 'os' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        OS / Chamados
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFiltroTimeline('preventiva')}
                                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all ${filtroTimeline === 'preventiva' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        Preventivas
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFiltroTimeline('movimentacao')}
                                        className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all ${filtroTimeline === 'movimentacao' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        Movimentações
                                    </button>
                                </div>
                            </div>

                            {/* FEED VERTICAL DA CRONOLOGIA */}
                            <div className="space-y-4 pt-4">
                                {timelineFiltrada.map((item, i) => (
                                    <div key={i} className="flex gap-4 group">
                                        
                                        {/* ÍCONE CONTEXTUAL */}
                                        <div className="flex flex-col items-center shrink-0">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                                                item.tipo?.includes('Abertura') ? 'bg-amber-500' :
                                                item.tipo?.includes('Preventiva') ? 'bg-emerald-600' :
                                                item.tipo?.includes('Planejada') ? 'bg-indigo-600' :
                                                item.tipo?.includes('Retorno') ? 'bg-emerald-500' :
                                                item.tipo?.includes('Movimentação') ? 'bg-purple-600' : 'bg-blue-600'
                                            }`}>
                                                {item.tipo?.includes('Abertura') ? '🚨' :
                                                 item.tipo?.includes('Preventiva') ? '📅' :
                                                 item.tipo?.includes('Planejada') ? '🗓️' :
                                                 item.tipo?.includes('Retorno') ? '🛬' :
                                                 item.tipo?.includes('Movimentação') ? '🔄' : '🔧'}
                                            </div>
                                            {i < timelineFiltrada.length - 1 && (
                                                <div className="w-0.5 bg-slate-200 flex-1 my-1"></div>
                                            )}
                                        </div>

                                        {/* CONTEÚDO DO EVENTO */}
                                        <div className="flex-1 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5 group-hover:bg-slate-100/70 transition-colors">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-800 uppercase tracking-tight">
                                                        {item.tipo || 'Intervenção Técnica'}
                                                    </span>
                                                    {item.ref_id > 0 && (
                                                        <span className="bg-slate-200 text-slate-700 text-[9px] font-black px-1.5 py-0.5 rounded">
                                                            OS #{item.ref_id}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-mono text-[10px] text-slate-400 font-bold">
                                                    {formatarDataHoraSegura(item.data)}
                                                </span>
                                            </div>

                                            <p className="text-xs font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                {item.evento}
                                            </p>

                                            <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between pt-1 border-t border-slate-200/50">
                                                <span>👤 Responsável: <strong className="text-slate-600">{item.responsavel || 'Sistema'}</strong></span>
                                                {item.status && <span className="uppercase text-[9px] font-black text-blue-600">{item.status}</span>}
                                            </div>

                                            {/* ANEXOS / LAUDOS FIXADOS AO EVENTO */}
                                            {item.url_anexo && (
                                                <div className="pt-2">
                                                    {isImagem(item.url_anexo) ? (
                                                        <div className="flex items-center gap-2">
                                                            <img 
                                                                src={`${BASE_URL}${item.url_anexo}`} 
                                                                alt="Anexo" 
                                                                className="w-14 h-14 object-cover rounded-xl border-2 border-slate-200 cursor-pointer hover:scale-105 transition-transform"
                                                                onClick={() => setImagemModal(`${BASE_URL}${item.url_anexo}`)}
                                                            />
                                                            <span className="text-[10px] font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => setImagemModal(`${BASE_URL}${item.url_anexo}`)}>
                                                                🔍 Ampliar Foto
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <a 
                                                            href={`${BASE_URL}${item.url_anexo}`} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-[10px] font-black hover:bg-blue-100 transition-colors border border-blue-200 uppercase shadow-sm"
                                                        >
                                                            <span>📄</span> Visualizar Laudo / PDF
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                ))}

                                {timelineFiltrada.length === 0 && (
                                    <p className="text-xs font-bold text-slate-400 italic text-center py-10">
                                        Nenhum evento registrado nesta categoria.
                                    </p>
                                )}
                            </div>

                        </div>
                    </div>

                </div>

            </div>

            {/* ⚙️ MODAL DE EDIÇÃO RÁPIDA DO ATIVO */}
            {modalEditarEquip && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-900 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center shrink-0">
                            <span>⚙️ Editar Dados do Ativo (ID #{id})</span>
                            <button onClick={() => setModalEditarEquip(false)} className="text-lg hover:text-red-400">✕</button>
                        </div>

                        <form onSubmit={handleSalvarEdicaoAtivo} className="p-6 space-y-4 overflow-y-auto text-xs">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nome do Equipamento *</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={formEquip.nome} 
                                    onChange={e => setFormEquip({ ...formEquip, nome: e.target.value })}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Patrimônio</label>
                                    <input 
                                        type="text" 
                                        value={formEquip.patrimonio} 
                                        onChange={e => setFormEquip({ ...formEquip, patrimonio: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-mono font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nº de Série</label>
                                    <input 
                                        type="text" 
                                        value={formEquip.num_serie} 
                                        onChange={e => setFormEquip({ ...formEquip, num_serie: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-mono font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fabricante / Marca</label>
                                    <input 
                                        type="text" 
                                        value={formEquip.fabricante} 
                                        onChange={e => setFormEquip({ ...formEquip, fabricante: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Modelo</label>
                                    <input 
                                        type="text" 
                                        value={formEquip.modelo} 
                                        onChange={e => setFormEquip({ ...formEquip, modelo: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Status Operacional</label>
                                    <select 
                                        value={formEquip.status} 
                                        onChange={e => setFormEquip({ ...formEquip, status: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    >
                                        <option value="Ativo">🟢 Ativo</option>
                                        <option value="Em Manutenção">🟡 Em Manutenção</option>
                                        <option value="Inoperante">🔴 Inoperante</option>
                                        <option value="Reserva">🔵 Reserva</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Setor de Localização</label>
                                    <select 
                                        value={formEquip.setor_id} 
                                        onChange={e => setFormEquip({ ...formEquip, setor_id: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    >
                                        <option value="">Sem Setor / Reserva</option>
                                        {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Tipo / Categoria</label>
                                    <select 
                                        value={formEquip.tipo_id} 
                                        onChange={e => setFormEquip({ ...formEquip, tipo_id: e.target.value })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    >
                                        <option value="">Geral / Sem Tipo</option>
                                        {tiposEquipamentos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Ciclo PMOC (Dias)</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        value={formEquip.periodicidade_preventiva} 
                                        onChange={e => setFormEquip({ ...formEquip, periodicidade_preventiva: Number(e.target.value) })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Valor de Compra (R$)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        min="0"
                                        value={formEquip.valor} 
                                        onChange={e => setFormEquip({ ...formEquip, valor: Number(e.target.value) })}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-mono font-bold text-xs bg-slate-50 outline-none focus:border-blue-500 text-slate-800"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Substituir Foto do Equipamento (Opcional)</label>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={e => setNovaFotoEquip(e.target.files[0])}
                                    className="w-full p-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 bg-slate-50"
                                />
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={() => setModalEditarEquip(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-black text-xs uppercase text-slate-500">Cancelar</button>
                                <button type="submit" disabled={salvandoEdicao} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-blue-100 active:scale-95 transition-all">
                                    {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 🚚 MODAL DE SAÍDA EXTERNA */}
            {modalSaidaExterna && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
                        <div className="bg-indigo-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🚚 Registrar Saída para Manutenção Externa</span>
                            <button onClick={() => setModalSaidaExterna(false)}>✕</button>
                        </div>

                        <form onSubmit={handleConfirmarSaidaExterna} className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Assistência Técnica / Fornecedor *</label>
                                <select 
                                    required 
                                    value={fornecedorId} 
                                    onChange={e => setFornecedorId(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-indigo-500 text-black"
                                >
                                    <option value="">Selecione o Fornecedor de Destino...</option>
                                    {fornecedores.map(f => (
                                        <option key={f.id} value={f.id}>🚚 {f.nome_fantasia} {f.cnpj ? `(CNPJ: ${f.cnpj})` : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Previsão Estimada de Retorno (Opcional)</label>
                                <input 
                                    type="date" 
                                    value={previsaoRetorno} 
                                    onChange={e => setPrevisaoRetorno(e.target.value)}
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-indigo-500 text-black"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Motivo / Defeito e Condições de Envio *</label>
                                <textarea 
                                    required 
                                    rows={3} 
                                    value={descricaoMotivo} 
                                    onChange={e => setDescricaoMotivo(e.target.value)}
                                    placeholder="Descreva a falha relatada, peças/acessórios enviados junto..."
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-indigo-500 text-black"
                                />
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={() => setModalSaidaExterna(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-black text-xs uppercase text-slate-500">Cancelar</button>
                                <button type="submit" disabled={enviandoSaida} className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-100">
                                    {enviandoSaida ? 'Gravando...' : 'Confirmar Saída & Imprimir Guia'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 🛬 MODAL DE REGISTRO DE RETORNO / ENTRADA */}
            {modalRetorno && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
                    <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
                        <div className="bg-emerald-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🛬 Registrar Retorno de Manutenção Externa</span>
                            <button onClick={() => setModalRetorno(false)}>✕</button>
                        </div>

                        <form onSubmit={handleConfirmarRetorno} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nº Nota Fiscal / Recibo</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: NF 00123"
                                        value={numeroNF} 
                                        onChange={e => setNumeroNF(e.target.value)}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-emerald-500 text-black"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Custo do Serviço (R$)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        min="0"
                                        placeholder="0.00"
                                        value={valorServico} 
                                        onChange={e => setValorServico(e.target.value)}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl font-bold text-xs bg-slate-50 outline-none focus:border-emerald-500 text-black"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Anexar Laudo Técnico / Relatório (PDF ou Foto)</label>
                                <input 
                                    type="file" 
                                    accept="image/*,application/pdf" 
                                    onChange={e => setArquivoLaudo(e.target.files[0])}
                                    className="w-full p-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 bg-slate-50"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Parecer Técnico / Testes de Recebimento</label>
                                <textarea 
                                    rows={3} 
                                    value={observacaoRetorno} 
                                    onChange={e => setObservacaoRetorno(e.target.value)}
                                    placeholder="Descreva o que foi corrigido pela assistência e o resultado do teste de inicialização..."
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-emerald-500 text-black"
                                />
                            </div>

                            <div className="flex gap-3 pt-3">
                                <button type="button" onClick={() => setModalRetorno(false)} className="flex-1 bg-slate-100 py-3 rounded-xl font-black text-xs uppercase text-slate-500">Cancelar</button>
                                <button type="submit" disabled={enviandoRetorno} className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-100">
                                    {enviandoRetorno ? 'Salvando...' : 'Confirmar Retorno & Ativar Equipamento'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* GUIA DE SAÍDA IMPRESSÃO A4 */}
            {guiaImpressao && (
                <div id="guia-saida-impressao" className="hidden print:block font-sans text-slate-900 bg-white p-6">
                    <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
                        <div>
                            <h1 className="text-lg font-black uppercase">CLÍNICA MATERNO INFANTIL DOMINGOS LOURENÇO</h1>
                            <p className="text-xs font-bold text-slate-600 uppercase">Engenharia Clínica & Gestão de Ativos — Guia de Remessa e Saída</p>
                        </div>
                        <div className="text-right">
                            <span className="text-base font-mono font-black border border-slate-900 px-2 py-1 rounded">GUIA Nº #{new Date().getFullYear()}/{guiaImpressao.equipamento.id}</span>
                            <p className="text-xs font-bold text-slate-500 mt-1">Data de Saída: {guiaImpressao.dataSaida}</p>
                        </div>
                    </div>

                    <div className="space-y-4 text-xs">
                        <div className="border-2 border-slate-200 p-4 rounded-xl bg-slate-50/50">
                            <h3 className="font-black uppercase text-xs mb-2 text-slate-700">1. Dados do Ativo / Equipamento</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div><strong>Equipamento:</strong> {guiaImpressao.equipamento.nome}</div>
                                <div><strong>Marca/Fabricante:</strong> {guiaImpressao.equipamento.fabricante || 'Não informado'}</div>
                                <div><strong>Modelo:</strong> {guiaImpressao.equipamento.modelo || 'N/A'}</div>
                                <div><strong>Patrimônio:</strong> {guiaImpressao.equipamento.patrimonio || 'S/P'}</div>
                                <div><strong>Nº de Série:</strong> {guiaImpressao.equipamento.num_serie || 'N/A'}</div>
                                <div><strong>Setor de Origem:</strong> {guiaImpressao.equipamento.setor_nome || 'Geral'}</div>
                            </div>
                        </div>

                        <div className="border-2 border-slate-200 p-4 rounded-xl bg-slate-50/50">
                            <h3 className="font-black uppercase text-xs mb-2 text-slate-700">2. Dados da Assistência / Destino</h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div><strong>Empresa / Fornecedor:</strong> {guiaImpressao.fornecedor?.nome_fantasia || 'Terceirizado'}</div>
                                <div><strong>CNPJ:</strong> {guiaImpressao.fornecedor?.cnpj || 'Não cadastrado'}</div>
                                <div><strong>Contato / Tel:</strong> {guiaImpressao.fornecedor?.telefone || guiaImpressao.fornecedor?.contato || '---'}</div>
                                <div><strong>Previsão de Retorno:</strong> {guiaImpressao.previsao ? formatarDataSegura(guiaImpressao.previsao) : 'A definir'}</div>
                            </div>
                        </div>

                        <div className="border-2 border-slate-200 p-4 rounded-xl bg-slate-50/50">
                            <h3 className="font-black uppercase text-xs mb-1 text-slate-700">3. Motivo da Saída / Condições de Envio</h3>
                            <p className="font-medium text-slate-800">{guiaImpressao.motivo}</p>
                        </div>
                    </div>

                    <p className="text-[10px] text-slate-500 mt-6 italic">
                        Declaramos que o equipamento acima discriminado foi retirado nesta data para fins de manutenção externa especializada e orçamento.
                    </p>

                    <div className="grid grid-cols-3 gap-6 text-center mt-20 pt-4">
                        <div>
                            <p className="border-t-2 border-slate-800 pt-1 font-bold">_______________________</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Responsável pela liberação interna</p>
                        </div>
                        <div>
                            <p className="border-t-2 border-slate-800 pt-1 font-bold">Portador / Transportador</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">RG/CPF: _________________</p>
                        </div>
                        <div>
                            <p className="border-t-2 border-slate-800 pt-1 font-bold">Recebedor (Assistência)</p>
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Data: ___/___/_______</p>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE EXPANSÃO DE IMAGENS */}
            {imagemModal && (
                <div 
                    className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150 hide-print"
                    onClick={() => setImagemModal(null)}
                >
                    <div className="relative max-w-3xl max-h-[90vh] bg-white p-2 rounded-3xl shadow-2xl">
                        <img 
                            src={imagemModal} 
                            alt="Visualização em alta resolução" 
                            className="max-w-full max-h-[85vh] rounded-2xl object-contain" 
                        />
                        <button 
                            type="button" 
                            className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full w-8 h-8 font-black text-xs shadow-lg"
                            onClick={() => setImagemModal(null)}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Prontuario;