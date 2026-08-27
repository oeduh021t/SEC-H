import { useEffect, useState } from 'react';
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

    // Estados do Modal de Baixa/Troca
    const [modalBaixa, setModalBaixa] = useState(false);
    const [filtroSelecionado, setFiltroSelecionado] = useState(null);
    const [obsIntervencao, setObsIntervencao] = useState('');
    const [itemIdSelecionado, setItemIdSelecionado] = useState(''); 
    const [tecnicoIdSelecionado, setTecnicoIdSelecionado] = useState('');
    const [qtdUsada, setQtdUsada] = useState(1); 

    const API_URL = 'http://192.168.5.101:3000/api';

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

    // 📊 EXPORTAÇÃO EXCEL (.XLSX)
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
                    obs_intervencao: obsIntervencao,
                    item_id: itemIdSelecionado ? Number(itemIdSelecionado) : null, 
                    quantidade: Number(qtdUsada)
                })
            });

            if (res.ok) {
                alert("Troca efetuada, insumo baixado e custo processado no histórico! 🔄💰");
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

    const filtrosFiltrados = filtros.filter(f => {
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

    const totais = filtros.reduce((acc, curr) => {
        if (curr.dias_restantes < 0) acc.vencidos++;
        else if (curr.dias_restantes <= 15) acc.atencao++;
        else acc.emDia++;
        return acc;
    }, { vencidos: 0, atencao: 0, emDia: 0 });

    const refisFiltrados = itensEstoque.filter(item => item.tipo?.toLowerCase() === 'filtro');

    // Paginação
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
                    <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🚰</span> MONITORAMENTO E TROCA DE FILTROS
                  </h1>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
                    Controle microbiológico, trocas preventivas e rastreio de refis
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
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
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
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                        filtroStatusCard === 'emDia' ? 'bg-green-600 text-white border-green-600 shadow-md' : 'bg-white border-slate-100 hover:bg-green-50/50'
                    }`}
                >
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${filtroStatusCard === 'emDia' ? 'text-green-100' : 'text-slate-400'}`}>Elementos Filtrantes em Dia</span>
                        <p className={`text-xl font-black mt-0.5 ${filtroStatusCard === 'emDia' ? 'text-white' : 'text-green-600'}`}>{totais.emDia} Pontos</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </button>

                <button 
                    type="button"
                    onClick={() => { setFiltroStatusCard(filtroStatusCard === 'atencao' ? 'todos' : 'atencao'); setPaginaAtual(1); }}
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
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
                    className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                        filtroStatusCard === 'vencidos' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-white border-slate-100 hover:bg-red-50/50'
                    }`}
                >
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${filtroStatusCard === 'vencidos' ? 'text-red-100' : 'text-slate-400'}`}>Saturação Crítica / Vencidos</span>
                        <p className={`text-xl font-black mt-0.5 ${filtroStatusCard === 'vencidos' ? 'text-white' : 'text-red-600'}`}>{totais.vencidos} Refis</p>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
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
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Trocar a cada (Meses)</label>
                                <input min="1" max="24" type="number" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-slate-800" value={periodicidadeMeses} onChange={e => setPeriodicidadeMeses(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Última Troca</label>
                                <input required type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-xs text-slate-800" value={dataUltimaTroca} onChange={e => setDataUltimaTroca(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Observações de Instalação</label>
                            <textarea rows={2} className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none focus:bg-white focus:border-blue-500 text-slate-800" placeholder="Ex: Utilizar chave de carcaça..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                        </div>

                        <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]">
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
                                    <th className="p-3.5">Status</th>
                                    <th className="p-3.5 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {filtrosPaginados.map((filtro) => (
                                    <tr key={filtro.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-black text-slate-700 uppercase">{filtro.nome}</div>
                                            {filtro.equipamento_nome && (
                                                <div className="text-[10px] font-bold text-blue-600 mt-0.5">
                                                    🚰 Ativo: {filtro.equipamento_nome} {filtro.equipamento_patrimonio ? `(PAT: ${filtro.equipamento_patrimonio})` : ''}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Refil: {filtro.modelo_refil || 'Padrão'}</div>
                                        </td>
                                        <td className="p-3.5 font-bold text-blue-600 uppercase tracking-tight">{filtro.setor_nome}</td>
                                        <td className="p-3.5">
                                            <div className="font-bold text-slate-600">{formatarDataSemFuso(filtro.data_vencimento)}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Última: {formatarDataSemFuso(filtro.data_ultima_troca)}</div>
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider inline-block ${
                                                filtro.dias_restantes < 0 ? 'bg-red-50 text-red-600 border border-red-100' :
                                                filtro.dias_restantes <= 15 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'
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
                                                        className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all border border-blue-100 text-xs"
                                                        title="Ver Prontuário do Bebedouro"
                                                    >
                                                        📋
                                                    </Link>
                                                )}

                                                <button 
                                                    onClick={() => handleAbrirModalTroca(filtro)}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm active:scale-95 transition-transform flex items-center gap-1"
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
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                >
                                    Anterior
                                </button>
                                <button
                                    onClick={() => setPaginaAtual(prev => Math.min(prev + 1, totalPaginas))}
                                    disabled={paginaAtual === totalPaginas}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* MODAL DE SUBSTITUIÇÃO */}
            {modalBaixa && filtroSelecionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 text-slate-800">
                        <div className="bg-green-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🔄 Registro de Baixa e Troca de Refil</span>
                            <button type="button" onClick={() => setModalBaixa(false)} className="font-bold hover:text-red-200">✕</button>
                        </div>
                        <form onSubmit={handleRegistrarTroca} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Ponto Alvo</p>
                                <p className="text-sm font-black text-slate-700 uppercase mt-0.5">{filtroSelecionado.nome}</p>
                                {filtroSelecionado.equipamento_nome && (
                                    <p className="text-xs font-bold text-blue-600 uppercase mt-1">🚰 Bebedouro: {filtroSelecionado.equipamento_nome}</p>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Técnico Responsável *</label>
                                <select 
                                    required
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-green-500 text-slate-700"
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
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Vincular Refil do Estoque (Deduzir Saldo)</label>
                                <select 
                                    className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-green-500 text-slate-700"
                                    value={itemIdSelecionado}
                                    onChange={e => setItemIdSelecionado(e.target.value)}
                                >
                                    <option value="">⚠️ Apenas registrar a data (Sem gastar item do estoque)</option>
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
                                    required 
                                    value={obsIntervencao}
                                    onChange={e => setObsIntervencao(e.target.value)}
                                    className="w-full border-2 border-slate-100 bg-slate-50/50 focus:bg-white rounded-2xl p-3 h-24 focus:border-green-500 outline-none transition-all resize-none text-xs font-medium text-slate-700" 
                                    placeholder="Descreva a higienização efetuada e os testes de vazão..."
                                />
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModalBaixa(false)} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-xs uppercase hover:bg-slate-200">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-green-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all">🔄 Confirmar Troca</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControleFiltros;