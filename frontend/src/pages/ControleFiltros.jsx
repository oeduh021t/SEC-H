import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const ControleFiltros = () => {
    const [filtros, setFiltros] = useState([]);
    const [setores, setSetores] = useState([]);
    const [equipamentos, setEquipamentos] = useState([]);
    const [itensEstoque, setItensEstoque] = useState([]); 
    const [tecnicos, setTecnicos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportando, setExportando] = useState(false);
    const [busca, setBusca] = useState('');
    const [filtroStatusCard, setFiltroStatusCard] = useState('todos');

    // Paginação
    const [paginaAtual, setPaginaAtual] = useState(1);
    const itensPorPagina = 8;

    // Estados do Formulário de Cadastro
    const [nome, setNome] = useState('');
    const [equipamentoId, setEquipamentoId] = useState('');
    const [setorId, setSetorId] = useState('');
    const [modeloRefil, setModeloRefil] = useState('');
    const [periodicidadeMeses, setPeriodicidadeMeses] = useState(3);
    const [dataUltimaTroca, setDataUltimaTroca] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');
    const [tecnicoCadastroId, setTecnicoCadastroId] = useState('');

    // Estados do Modal de Baixa/Troca Técnica
    const [modalBaixa, setModalBaixa] = useState(false);
    const [filtroSelecionado, setFiltroSelecionado] = useState(null);
    const [obsIntervencao, setObsIntervencao] = useState('');
    const [itemIdSelecionado, setItemIdSelecionado] = useState(''); 
    const [tecnicoIdSelecionado, setTecnicoIdSelecionado] = useState('');
    const [qtdUsada, setQtdUsada] = useState(1);
    
    // Checklist Sanitário
    const [checkSanitizacao, setCheckSanitizacao] = useState(true);
    const [checkLimpezaBicas, setCheckLimpezaBicas] = useState(true);
    const [checkPurgamento, setCheckPurgamento] = useState(true);

    // Estados do Modal de Histórico Individual do Ponto
    const [modalHistoricoPonto, setModalHistoricoPonto] = useState(false);
    const [historicoPonto, setHistoricoPonto] = useState([]);
    const [loadingHistoricoPonto, setLoadingHistoricoPonto] = useState(false);
    const [pontoHistoricoSelecionado, setPontoHistoricoSelecionado] = useState(null);

    const API_URL = '/api';

    const obterNivelUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser).nivel : '';
    };

    const formatarDataSemFuso = (dataString) => {
        if (!dataString) return '--/--/----';
        const [ano, mes, dia] = dataString.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const carregarDados = async () => {
        setLoading(true);
        try {
            const headers = {
                'Content-Type': 'application/json',
                'x-usuario-nivel': obterNivelUsuario()
            };

            const [resFiltros, resSetores, resEquipamentos, resEstoque, resTecnicos] = await Promise.all([
                fetch(`${API_URL}/filtros`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/setores`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/equipamentos`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/estoque`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/tecnicos`, { headers }).then(res => res.json())
            ]);

            const bebedourosApenas = (resEquipamentos || []).filter(eq => 
                Number(eq.tipo_id) === 19 || Number(eq.tipo_equipamento_id) === 19
            );

            setFiltros(resFiltros || []);
            setSetores(resSetores || []);
            setEquipamentos(bebedourosApenas);
            setItensEstoque(resEstoque || []);
            setTecnicos(resTecnicos || []);

            const savedUser = localStorage.getItem('user');
            if (savedUser) {
                const userObj = JSON.parse(savedUser);
                const enco = (resTecnicos || []).find(t => Number(t.id) === Number(userObj.id) || t.nome.toLowerCase() === userObj.nome?.toLowerCase());
                if (enco) setTecnicoCadastroId(String(enco.id));
            }
        } catch (err) {
            console.error("Erro ao carregar dados de filtros:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregarDados(); }, []);

    const handleExportarExcel = async () => {
        setExportando(true);
        try {
            const res = await fetch(`${API_URL}/relatorios/exportar/filtros`, {
                headers: { 'x-usuario-nivel': obterNivelUsuario() }
            });

            if (!res.ok) throw new Error("Falha ao gerar arquivo Excel.");

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `cronograma_filtros_${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            alert("Erro ao exportar Excel: " + err.message);
        } finally {
            setExportando(false);
        }
    };

    const handleSelecionarEquipamento = (id) => {
        setEquipamentoId(id);
        if (!id) return;

        const eq = equipamentos.find(e => Number(e.id) === Number(id));
        if (eq) {
            if (eq.setor_id) setSetorId(String(eq.setor_id));
            if (!nome) setNome(`${eq.nome} (${eq.patrimonio || 'S/P'})`);
        }
    };

    const handleAbrirModalTroca = (filtro) => {
        setFiltroSelecionado(filtro);
        setCheckSanitizacao(true);
        setCheckLimpezaBicas(true);
        setCheckPurgamento(true);
        
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const userObj = JSON.parse(savedUser);
            const enco = tecnicos.find(t => Number(t.id) === Number(userObj.id) || t.nome.toLowerCase() === userObj.nome?.toLowerCase());
            if (enco) setTecnicoIdSelecionado(String(enco.id));
            else setTecnicoIdSelecionado('');
        } else {
            setTecnicoIdSelecionado('');
        }

        setModalBaixa(true);
    };

    const handleVerHistoricoPonto = async (filtro) => {
        setPontoHistoricoSelecionado(filtro);
        setModalHistoricoPonto(true);
        setLoadingHistoricoPonto(true);
        try {
            const res = await fetch(`${API_URL}/filtros/${filtro.id}/historico`, {
                headers: { 'x-usuario-nivel': obterNivelUsuario() }
            });
            const data = await res.json();
            setHistoricoPonto(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Erro ao buscar histórico do filtro:", err);
            setHistoricoPonto([]);
        } finally {
            setLoadingHistoricoPonto(false);
        }
    };

    const handleCadastrarFiltro = async (e) => {
        e.preventDefault();
        if (!nome || !setorId) return;

        const tecEncontrado = tecnicos.find(t => Number(t.id) === Number(tecnicoCadastroId));
        const tecnicoNome = tecEncontrado ? tecEncontrado.nome : 'Técnico do Sistema';

        const novoFiltro = {
            nome: nome.trim(),
            equipamento_id: equipamentoId || null,
            setor_id: setorId,
            modelo_refil: modeloRefil.trim(),
            data_ultima_troca: dataUltimaTroca,
            periodicidade_meses: Number(periodicidadeMeses),
            observacoes: observacoes ? `[Cadastrado por: ${tecnicoNome}] ${observacoes}` : `[Cadastrado por: ${tecnicoNome}]`
        };

        try {
            const res = await fetch(`${API_URL}/filtros`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-usuario-nivel': obterNivelUsuario()
                },
                body: JSON.stringify(novoFiltro)
            });

            if (res.ok) {
                alert("Ponto de filtragem monitorado com sucesso! 🚰✅");
                setNome(''); setEquipamentoId(''); setSetorId(''); setModeloRefil('');
                setPeriodicidadeMeses(3); setObservacoes('');
                carregarDados();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRegistrarTroca = async (e) => {
        e.preventDefault();
        
        const tecEncontrado = tecnicos.find(t => Number(t.id) === Number(tecnicoIdSelecionado));
        const tecnicoNome = tecEncontrado ? tecEncontrado.nome : 'Técnico do Sistema';

        const checklistTextos = [];
        if (checkSanitizacao) checklistTextos.push("Sanitização de reservatório realizada");
        if (checkLimpezaBicas) checklistTextos.push("Limpeza de bicas e cuba");
        if (checkPurgamento) checklistTextos.push("Descarte inicial / purgamento efetuado");

        const laudoFormatado = [
            checklistTextos.length > 0 ? `[Protocolo Sanitário: ${checklistTextos.join(' | ')}]` : '',
            obsIntervencao ? obsIntervencao.trim() : 'Troca preventiva do elemento filtrante e higienização executadas.'
        ].filter(Boolean).join(' - ');

        try {
            const res = await fetch(`${API_URL}/filtros/baixa`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-usuario-nivel': obterNivelUsuario()
                },
                body: JSON.stringify({
                    filtro_id: filtroSelecionado.id,
                    tecnico_nome: tecnicoNome,
                    obs_intervencao: laudoFormatado,
                    item_id: itemIdSelecionado ? Number(itemIdSelecionado) : null, 
                    quantidade: Number(qtdUsada)
                })
            });

            if (res.ok) {
                alert("Troca efetuada, insumo baixado e registado no prontuário do bebedouro! 🔄💰");
                setModalBaixa(false);
                setObsIntervencao('');
                setItemIdSelecionado('');
                setTecnicoIdSelecionado('');
                setQtdUsada(1);
                setFiltroSelecionado(null);
                carregarDados();
            } else {
                const erroData = await res.json();
                alert(`❌ Erro: ${erroData.error || 'Estoque insuficiente ou erro no processamento.'}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filtrosFiltrados = useMemo(() => {
        return filtros.filter(f => {
            const termo = busca.toLowerCase();
            const matchBusca = (
                (f.nome && f.nome.toLowerCase().includes(termo)) ||
                (f.modelo_refil && f.modelo_refil.toLowerCase().includes(termo)) ||
                (f.setor_nome && f.setor_nome.toLowerCase().includes(termo)) ||
                (f.equipamento_nome && f.equipamento_nome.toLowerCase().includes(termo)) ||
                (f.equipamento_patrimonio && f.equipamento_patrimonio.toLowerCase().includes(termo))
            );

            let matchCard = true;
            if (filtroStatusCard === 'vencidos') matchCard = f.dias_restantes < 0;
            else if (filtroStatusCard === 'atencao') matchCard = f.dias_restantes >= 0 && f.dias_restantes <= 15;
            else if (filtroStatusCard === 'emDia') matchCard = f.dias_restantes > 15;

            return matchBusca && matchCard;
        });
    }, [filtros, busca, filtroStatusCard]);

    const totais = useMemo(() => {
        return filtros.reduce((acc, curr) => {
            if (curr.dias_restantes < 0) acc.vencidos++;
            else if (curr.dias_restantes <= 15) acc.atencao++;
            else acc.emDia++;
            return acc;
        }, { vencidos: 0, atencao: 0, emDia: 0 });
    }, [filtros]);

    const refisFiltrados = useMemo(() => {
        return itensEstoque.filter(item => 
            item.tipo?.toLowerCase() === 'filtro' || 
            item.nome?.toLowerCase().includes('refil') || 
            item.nome?.toLowerCase().includes('filtro')
        );
    }, [itensEstoque]);

    const totalPaginas = Math.ceil(filtrosFiltrados.length / itensPorPagina) || 1;
    const indexInicio = (paginaAtual - 1) * itensPorPagina;
    const filtrosPaginados = filtrosFiltrados.slice(indexInicio, indexInicio + itensPorPagina);

    if (loading) return (
        <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
            Processando cronograma de saturação dos refis...
        </div>
    );

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* CABEÇALHO */}
            <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-600 p-2 rounded-xl text-white text-xs font-black shadow-sm">🚰</span> MONITORAMENTO E QUALIDADE DA ÁGUA
                  </h1>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    Controle de Saturação de Refis, Protocolo Sanitário e Rastreio de Ativos
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <input 
                      type="text" 
                      placeholder="🔍 Buscar ponto, bebedouro ou refil..." 
                      className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-72 focus:border-blue-500 transition-colors text-slate-800"
                      value={busca}
                      onChange={e => { setBusca(e.target.value); setPaginaAtual(1); }}
                    />

                    <button
                        type="button"
                        onClick={handleExportarExcel}
                        disabled={exportando}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        title="Exportar cronograma de filtros em planilha"
                    >
                        <span>📊</span> {exportando ? "..." : "Excel"}
                    </button>
                </div>
            </div>

            {/* CARDS INDICADORES INTERATIVOS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <button 
                    type="button"
                    onClick={() => { setFiltroStatusCard(filtroStatusCard === 'emDia' ? 'todos' : 'emDia'); setPaginaAtual(1); }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        filtroStatusCard === 'emDia' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white border-slate-100 hover:bg-emerald-50/50'
                    }`}
                >
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${filtroStatusCard === 'emDia' ? 'text-emerald-100' : 'text-slate-400'}`}>Elementos Filtrantes em Dia</span>
                        <p className={`text-xl font-black mt-0.5 ${filtroStatusCard === 'emDia' ? 'text-white' : 'text-emerald-600'}`}>{totais.emDia} Pontos</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </button>

                <button 
                    type="button"
                    onClick={() => { setFiltroStatusCard(filtroStatusCard === 'atencao' ? 'todos' : 'atencao'); setPaginaAtual(1); }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        filtroStatusCard === 'atencao' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-white border-slate-100 hover:bg-amber-50/50'
                    }`}
                >
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${filtroStatusCard === 'atencao' ? 'text-amber-100' : 'text-slate-400'}`}>Atenção (Trocar em 15 dias)</span>
                        <p className={`text-xl font-black mt-0.5 ${filtroStatusCard === 'atencao' ? 'text-white' : 'text-amber-600'}`}>{totais.atencao} Pontos</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                </button>

                <button 
                    type="button"
                    onClick={() => { setFiltroStatusCard(filtroStatusCard === 'vencidos' ? 'todos' : 'vencidos'); setPaginaAtual(1); }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                        filtroStatusCard === 'vencidos' ? 'bg-rose-600 text-white border-rose-600 shadow-md' : 'bg-white border-slate-100 hover:bg-rose-50/50'
                    }`}
                >
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${filtroStatusCard === 'vencidos' ? 'text-rose-100' : 'text-slate-400'}`}>Saturação Crítica / Vencidos</span>
                        <p className={`text-xl font-black mt-0.5 ${filtroStatusCard === 'vencidos' ? 'text-white' : 'text-rose-600'}`}>{totais.vencidos} Refis</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* FORMULÁRIO DE CADASTRO */}
                <div className="lg:col-span-4">
                    <form onSubmit={handleCadastrarFiltro} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
                            <span>➕</span> Novo Ponto de Filtragem
                        </h3>
                        
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Técnico Responsável *</label>
                            <select 
                                required 
                                className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500 text-slate-700" 
                                value={tecnicoCadastroId} 
                                onChange={e => setTecnicoCadastroId(e.target.value)}
                            >
                                <option value="">Selecione o Técnico...</option>
                                {tecnicos.map(tec => (
                                    <option key={tec.id} value={tec.id}>
                                        👤 {tec.nome}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Vincular Bebedouro Cadastrado (Opcional)</label>
                            <select 
                                className="w-full p-2.5 border-2 border-blue-100 rounded-xl bg-blue-50/50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500 text-slate-700" 
                                value={equipamentoId} 
                                onChange={e => handleSelecionarEquipamento(e.target.value)}
                            >
                                <option value="">Sem bebedouro específico (Ponto de parede / Torneira)</option>
                                {equipamentos.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        🚰 {eq.nome} {eq.patrimonio ? `(PAT: ${eq.patrimonio})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Identificação do Ponto *</label>
                            <input required type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-800" placeholder="Ex: Bebedouro Recepção, Purificador UTI" value={nome} onChange={e => setNome(e.target.value)} />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Localização / Setor *</label>
                            <select required className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500 text-slate-700" value={setorId} onChange={e => setSetorId(e.target.value)}>
                                <option value="">Selecione o Setor...</option>
                                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Modelo do Elemento Filtrante (Refil)</label>
                            <input type="text" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500 text-slate-800" placeholder="Ex: Carbon Block 9' 3/4, Plissado 5m" value={modeloRefil} onChange={e => setModeloRefil(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Ciclo (Meses)</label>
                                <input min="1" max="24" type="number" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-slate-800" value={periodicidadeMeses} onChange={e => setPeriodicidadeMeses(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Última Troca</label>
                                <input required type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-xs text-slate-800" value={dataUltimaTroca} onChange={e => setDataUltimaTroca(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Observações de Instalação</label>
                            <textarea rows={2} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none focus:bg-white focus:border-blue-500 text-slate-800" placeholder="Ex: Utilizar chave de carcaça padrão 10 pol..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                        </div>

                        <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer">
                            💾 Monitorar Ponto de Água
                        </button>
                    </form>
                </div>

                {/* TABELA DE PONTOS MONITORADOS */}
                <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                            Cronograma de Saturação de Refis
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {filtrosFiltrados.length} Pontos Mapeados
                        </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                    <th className="p-3.5">Ponto / Bebedouro</th>
                                    <th className="p-3.5">Setor</th>
                                    <th className="p-3.5">Vencimento</th>
                                    <th className="p-3.5">Status Sanitário</th>
                                    <th className="p-3.5 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filtrosPaginados.map((filtro) => (
                                    <tr key={filtro.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-black text-slate-800 uppercase">{filtro.nome}</div>
                                            {filtro.equipamento_nome && (
                                                <div className="text-[10px] font-bold text-blue-600 mt-0.5">
                                                    🚰 Ativo: {filtro.equipamento_nome} {filtro.equipamento_patrimonio ? `(PAT: ${filtro.equipamento_patrimonio})` : ''}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Refil: {filtro.modelo_refil || 'Padrão'}</div>
                                        </td>
                                        <td className="p-3.5 font-bold text-slate-700 uppercase tracking-tight">{filtro.setor_nome}</td>
                                        <td className="p-3.5">
                                            <div className="font-bold text-slate-700">{formatarDataSemFuso(filtro.data_vencimento)}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Última: {formatarDataSemFuso(filtro.data_ultima_troca)}</div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider inline-block ${
                                                filtro.dias_restantes < 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                filtro.dias_restantes <= 15 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            }`}>
                                                {filtro.dias_restantes < 0 ? `🚨 Vencido há ${Math.abs(filtro.dias_restantes)} dias` :
                                                 filtro.dias_restantes === 0 ? '⚠️ Vence Hoje' : `✅ Restam ${filtro.dias_restantes} dias`}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {filtro.equipamento_id && (
                                                    <Link
                                                        to={`/prontuario/${filtro.equipamento_id}`}
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-blue-100 text-xs shadow-2xs"
                                                        title="Ver Prontuário do Bebedouro"
                                                    >
                                                        📋
                                                    </Link>
                                                )}

                                                {/* 📜 HISTÓRICO RÁPIDO DO PONTO */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleVerHistoricoPonto(filtro)}
                                                    className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-700 hover:text-white rounded-xl transition-all border border-slate-200 text-xs shadow-2xs cursor-pointer"
                                                    title="Ver Histórico de Trocas deste Ponto"
                                                >
                                                    📜
                                                </button>

                                                <button 
                                                    onClick={() => handleAbrirModalTroca(filtro)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm active:scale-95 transition-transform flex items-center gap-1 cursor-pointer"
                                                >
                                                    <span>🔄</span> Trocar Refil
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {filtrosFiltrados.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="p-10 text-center text-slate-400 font-bold italic">
                                            Nenhum ponto de filtragem atende aos filtros aplicados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* PAGINAÇÃO */}
                    {filtrosFiltrados.length > 0 && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2 mt-4">
                            <span className="text-[10px] font-bold text-slate-400">
                                Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
                            </span>

                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPaginaAtual(prev => Math.max(prev - 1, 1))}
                                    disabled={paginaAtual === 1}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                                    disabled={paginaAtual === totalPaginas}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* MODAL DE TROCA COM PROTOCOLO SANITÁRIO INTEGRADO */}
            {modalBaixa && filtroSelecionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 text-slate-800">
                        <div className="bg-emerald-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🔄 Registro Técnico de Troca & Protocolo Sanitário</span>
                            <button type="button" onClick={() => setModalBaixa(false)} className="font-bold hover:text-red-200 cursor-pointer">✕</button>
                        </div>
                        <form onSubmit={handleRegistrarTroca} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Ponto Alvo</p>
                                <p className="text-sm font-black text-slate-800 uppercase mt-0.5">{filtroSelecionado.nome}</p>
                                {filtroSelecionado.equipamento_nome && (
                                    <p className="text-xs font-bold text-blue-600 uppercase mt-1">🚰 Bebedouro: {filtroSelecionado.equipamento_nome}</p>
                                )}
                            </div>

                            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block">
                                    Conformidade Sanitária (Boas Práticas de Higienização):
                                </span>
                                <div className="space-y-1.5 text-xs text-emerald-950 font-bold">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={checkSanitizacao} 
                                            onChange={e => setCheckSanitizacao(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-0" 
                                        />
                                        <span>Sanitização do reservatório interno com solução clorada</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={checkLimpezaBicas} 
                                            onChange={e => setCheckLimpezaBicas(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-0" 
                                        />
                                        <span>Desincrustação e assepsia das bicas e cuba</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={checkPurgamento} 
                                            onChange={e => setCheckPurgamento(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-0" 
                                        />
                                        <span>Drenagem inicial de 5 litros de ativação do carvão</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Técnico Responsável *</label>
                                <select 
                                    required
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-emerald-500 text-slate-700"
                                    value={tecnicoIdSelecionado}
                                    onChange={e => setTecnicoIdSelecionado(e.target.value)}
                                >
                                    <option value="">Selecione o Técnico...</option>
                                    {tecnicos.map(tec => (
                                        <option key={tec.id} value={tec.id}>
                                            👤 {tec.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Vincular Refil do Almoxarifado (Deduzir Saldo)</label>
                                <select 
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-emerald-500 text-slate-700"
                                    value={itemIdSelecionado}
                                    onChange={e => setItemIdSelecionado(e.target.value)}
                                >
                                    <option value="">⚠️ Apenas registrar a data (Sem baixar do estoque)</option>
                                    {refisFiltrados.map(item => (
                                        <option key={item.id} value={item.id}>
                                            📦 {item.nome} {item.referencia ? `[REF: ${item.referencia}]` : ''} — Saldo: {item.quantidade} un. (R$ {Number(item.valor_unitario).toFixed(2)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {itemIdSelecionado && (
                                <div className="w-1/2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Quantidade Utilizada</label>
                                    <input 
                                        type="number" min="1" required
                                        className="w-full p-2 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-slate-800"
                                        value={qtdUsada}
                                        onChange={e => setQtdUsada(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Laudo / Observações Técnicas</label>
                                <textarea 
                                    value={obsIntervencao}
                                    onChange={e => setObsIntervencao(e.target.value)}
                                    className="w-full border-2 border-slate-100 bg-slate-50/50 focus:bg-white rounded-2xl p-3 h-20 focus:border-emerald-500 outline-none transition-all resize-none text-xs font-medium text-slate-700" 
                                    placeholder="Ex: Troca preventiva executada, fluxo de água límpido sem gosto ou odores..."
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModalBaixa(false)} className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-xs uppercase hover:bg-slate-200 cursor-pointer">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer">🔄 Confirmar Troca</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 📜 NOVO MODAL: HISTÓRICO RÁPIDO DO PONTO DE FILTRAGEM */}
            {modalHistoricoPonto && pontoHistoricoSelecionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 flex flex-col max-h-[85vh]">
                        <div className="bg-slate-900 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center shrink-0">
                            <span>📜 Histórico de Trocas & Higienizações</span>
                            <button type="button" onClick={() => setModalHistoricoPonto(false)} className="font-bold hover:text-slate-300 cursor-pointer">✕</button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase">Ponto Monitorado</span>
                                <h4 className="text-sm font-black text-slate-800 uppercase mt-0.5">{pontoHistoricoSelecionado.nome}</h4>
                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    Setor: <strong>{pontoHistoricoSelecionado.setor_nome}</strong> • Refil: <strong>{pontoHistoricoSelecionado.modelo_refil || 'Padrão'}</strong>
                                </p>
                            </div>

                            {loadingHistoricoPonto ? (
                                <div className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-wider animate-pulse">
                                    Carregando histórico do ponto...
                                </div>
                            ) : historicoPonto.length === 0 ? (
                                <div className="text-center py-8 text-xs font-bold text-slate-400 uppercase italic">
                                    Nenhuma troca anterior registada para este ponto.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {historicoPonto.map(item => (
                                        <div key={item.id} className="p-4 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/50 transition-colors shadow-2xs space-y-1.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="font-black text-slate-800 font-mono">
                                                    📅 {formatarDataSemFuso(item.data_troca)}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                                    👤 {item.tecnico_nome}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-line">
                                                {item.obs_intervencao}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setModalHistoricoPonto(false)}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ControleFiltros;