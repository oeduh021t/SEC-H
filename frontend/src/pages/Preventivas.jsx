import { useEffect, useState } from 'react';

const Preventivas = () => {
    const [dados, setDados] = useState([]);
    const [setores, setSetores] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Controle de Modais e Formulário
    const [modalBaixa, setModalBaixa] = useState(false);
    const [selecionado, setSelecionado] = useState(null);
    const [relatorio, setRelatorio] = useState('');

    // Estados dos Filtros Dinâmicos (Busca Global + Select)
    const [busca, setBusca] = useState('');
    const [setorSelecionado, setSetorSelecionado] = useState('todos');
    
    // 🆕 NOVO ESTADO: Controla qual card de status está ativo no filtro ('todos', 'emDia', 'criticas', 'atrasadas')
    const [filtroStatusCard, setFiltroStatusCard] = useState('todos');

    const API_URL = 'http://192.168.5.101:3000/api';

    // 🔑 AUXILIAR: Captura dinamicamente o privilégio operacional do operador para passar pelo middleware
    const obterNivelUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser).nivel : '';
    };

    const carregarDados = async () => {
        setLoading(true);
        try {
            const headersComNivel = {
                'Content-Type': 'application/json',
                'x-usuario-nivel': obterNivelUsuario()
            };

            const [resPreventivas, resSetores] = await Promise.all([
                fetch(`${API_URL}/preventivas`, { headers: headersComNivel }).then(res => res.json()),
                fetch(`${API_URL}/setores`, { headers: headersComNivel }).then(res => res.json())
            ]);
            setDados(resPreventivas || []);
            setSetores(resSetores || []);
        } catch (err) {
            console.error("Erro ao carregar dados de preventivas:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregarDados(); }, []);

    const handleBaixa = (e) => {
        e.preventDefault();
        
        const userLogado = localStorage.getItem('user');
        const tecnicoNome = userLogado ? JSON.parse(userLogado).nome : 'Técnico do Sistema';

        fetch(`${API_URL}/preventivas/baixa`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-usuario-nivel': obterNivelUsuario() 
            },
            body: JSON.stringify({
                equipamento_id: selecionado.id,
                relatorio_tecnico: relatorio,
                tecnico_nome: tecnicoNome
            })
        }).then((res) => {
            if (res.ok) {
                alert("Baixa de preventiva registrada e cronologia atualizada! 📅🎉");
                setModalBaixa(false);
                setRelatorio('');
                carregarDados();
            } else {
                alert("Erro ao registrar a baixa da preventiva. Verifique as credenciais de acesso.");
            }
        });
    };

    // 🔄 FILTRAGEM ATUALIZADA - Combina busca global, select de setor e cliques nos cards
    const dadosFiltrados = dados.filter(p => {
        const termo = busca.toLowerCase();

        // 1. Busca textual global
        const matchesBusca = 
            (p.nome && p.nome.toLowerCase().includes(termo)) || 
            (p.patrimonio && p.patrimonio.toLowerCase().includes(termo)) ||
            (p.setor_nome && p.setor_nome.toLowerCase().includes(termo)) ||
            (p.tipo_nome && p.tipo_nome.toLowerCase().includes(termo));

        // 2. Filtro do select lateral de setores
        const matchesSetor = setorSelecionado === 'todos' || String(p.setor_id) === String(setorSelecionado);

        // 3. 🆕 Filtro lógico baseado no card clicado (mesma regra do reduce de totais)
        let matchesCard = true;
        if (filtroStatusCard === 'atrasadas') {
            matchesCard = p.dias_restantes < 0;
        } else if (filtroStatusCard === 'criticas') {
            matchesCard = p.dias_restantes >= 0 && p.dias_restantes <= 7;
        } else if (filtroStatusCard === 'emDia') {
            matchesCard = p.dias_restantes > 7;
        }

        return matchesBusca && matchesSetor && matchesCard;
    });

    // CÁLCULO DOS INDICADORES DO PAINEL SUPERIOR
    const totais = dados.reduce((acc, curr) => {
        if (curr.dias_restantes < 0) acc.atrasadas++;
        else if (curr.dias_restantes <= 7) acc.criticas++;
        else acc.emDia++;
        return acc;
    }, { atrasadas: 0, criticas: 0, emDia: 0 });

    // Função utilitária para alternar filtros ao clicar no card (clicar no mesmo limpa o filtro)
    const alternarFiltroCard = (tipoCard) => {
        setFiltroStatusCard(prev => prev === tipoCard ? 'todos' : tipoCard);
    };

    if (loading) return (
        <div className="p-10 text-center animate-pulse text-slate-500 font-black tracking-widest uppercase text-xs">
            ⌛ Mapeando cronograma e rotinas de PMOC...
        </div>
    );

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* TÍTULO E CABEÇALHO */}
            <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-3">
                        <span className="bg-green-500 p-2 rounded-xl text-white text-sm">📅</span>
                        GESTÃO DE PREVENTIVAS / PMOC
                    </h1>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Controle integrado de calibração e manutenção preventiva de ativos</p>
                </div>
                {filtroStatusCard !== 'todos' && (
                    <button 
                        onClick={() => setFiltroStatusCard('todos')}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-600 font-black px-4 py-2 rounded-xl text-[10px] uppercase tracking-wider transition-colors"
                    >
                        ❌ Limpar Filtro de Card
                    </button>
                )}
            </div>

            {/* PAINEL DE INDICADORES CARDS (Agora Clicáveis e Reativos) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                
                {/* CARD: EM DIA */}
                <div 
                    onClick={() => { alternarFiltroCard('emDia'); }}
                    className={`p-4 rounded-2xl shadow-sm border bg-white flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] hover:shadow-md ${
                        filtroStatusCard === 'emDia' ? 'border-green-500 ring-2 ring-green-500/20 bg-green-50/10' : 'border-slate-100'
                    }`}
                >
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cronograma em Dia</span>
                        <p className="text-xl font-black text-green-600 mt-0.5">{totais.emDia} Ativos</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                </div>

                {/* CARD: ATENÇÃO */}
                <div 
                    onClick={() => { alternarFiltroCard('criticas'); }}
                    className={`p-4 rounded-2xl shadow-sm border bg-white flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] hover:shadow-md ${
                        filtroStatusCard === 'criticas' ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10' : 'border-slate-100'
                    }`}
                >
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atenção (Vence em 7 dias)</span>
                        <p className="text-xl font-black text-amber-500 mt-0.5">{totais.criticas} Ativos</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                </div>

                {/* CARD: ATRASADAS */}
                <div 
                    onClick={() => { alternarFiltroCard('atrasadas'); }}
                    className={`p-4 rounded-2xl shadow-sm border bg-white flex items-center justify-between cursor-pointer select-none transition-all active:scale-[0.99] hover:shadow-md ${
                        filtroStatusCard === 'atrasadas' ? 'border-red-500 ring-2 ring-red-500/20 bg-red-50/10' : 'border-slate-100'
                    }`}
                >
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atrasadas / Pendentes</span>
                        <p className="text-xl font-black text-red-500 mt-0.5">{totais.atrasadas} Roteiros</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                </div>

            </div>

            {/* BARRA DE FILTROS DINÂMICOS COM BUSCA GLOBAL */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Busca Global (Multi-Campo)</label>
                    <input 
                        type="text" 
                        placeholder="🔍 Digite Nome do Equipamento, Patrimônio ou Centro de Custo..." 
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" 
                        value={busca} 
                        onChange={e => setBusca(e.target.value)} 
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Isolar por Localização / Setor</label>
                    <select 
                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700" 
                        value={setorSelecionado} 
                        onChange={e => setSetorSelecionado(e.target.value)}
                    >
                        <option value="todos">⭐ Todos os Setores</option>
                        {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </select>
                </div>
            </div>

            {/* TABELA DE ATIVOS */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50/70 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                            <tr>
                                <th className="p-5">Equipamento Patrimonial</th>
                                <th className="p-5">Centro de Custo</th>
                                <th className="p-5">Vencimento / Ciclo</th>
                                <th className="p-5">Janela Operacional</th>
                                <th className="p-5 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {dadosFiltrados.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="p-5">
                                        <div className="font-black text-slate-700 uppercase">{p.nome}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">Patrimônio: {p.patrimonio || 'S/P'}</div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-black text-blue-600 uppercase tracking-wider">{p.setor_nome}</div>
                                        <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{p.tipo_nome || 'Aparelho'}</div>
                                    </td>
                                    <td className="p-5">
                                        <div className="font-bold text-slate-700">{new Date(p.data_vencimento).toLocaleDateString('pt-BR')}</div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Última: {new Date(p.data_ultima_preventiva).toLocaleDateString('pt-BR')}</div>
                                    </td>
                                    <td className="p-5">
                                        <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                                            p.dias_restantes < 0 ? 'bg-red-50 text-red-600 border border-red-100' : 
                                            p.dias_restantes <= 7 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'
                                        }`}>
                                            {p.dias_restantes < 0 ? `🚨 Atrasada há ${Math.abs(p.dias_restantes)} dias` : 
                                             p.dias_restantes === 0 ? '⚠️ Vence Hoje' : `✅ Restam ${p.dias_restantes} dias`}
                                        </span>
                                    </td>
                                    <td className="p-5 text-center">
                                        <button 
                                            onClick={() => { setSelecionado(p); setModalBaixa(true); }}
                                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase shadow-md hover:shadow-lg transition-all active:scale-95"
                                        >
                                            🔧 Dar Baixa
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {dadosFiltrados.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-10 text-center text-xs font-bold text-slate-400 italic">
                                        Nenhum roteiro localizado para os filtros ativos ({filtroStatusCard === 'todos' ? 'Geral' : `Filtrado por: ${filtroStatusCard}`}).
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE BAIXA TÉCNICA */}
            {modalBaixa && selecionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <form onSubmit={handleBaixa} className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
                        <div className="bg-green-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🔧 Registro de Manutenção Preventiva</span>
                            <button type="button" onClick={() => setModalBaixa(false)} className="hover:text-red-200 font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Ativo Alvo</p>
                                <p className="text-sm font-black text-slate-700 uppercase mt-0.5">{selecionado.nome}</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">Patrimônio: {selecionado.patrimonio} | Setor: {selecionado.setor_nome}</p>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Laudo / Relatório de Execução</label>
                                <textarea 
                                    required 
                                    value={relatorio}
                                    onChange={e => setRelatorio(e.target.value)}
                                    className="w-full border-2 border-slate-100 bg-slate-50/50 focus:bg-white rounded-2xl p-4 h-32 focus:border-green-500 outline-none transition-all resize-none text-xs font-medium text-slate-700 text-black" 
                                    placeholder="Descreva detalhadamente as ações preventivas efetuadas..."
                                ></textarea>
                            </div>
                            
                            <div className="bg-blue-50 p-3.5 rounded-xl flex items-center gap-3 border border-blue-100">
                                <span className="text-lg">ℹ️</span>
                                <p className="text-[10px] font-bold text-blue-600 leading-tight">Ao confirmar, o ciclo da preventiva reiniciará de acordo com a periodicidade programada.</p>
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModalBaixa(false)} className="flex-1 bg-slate-100 text-slate-400 py-3.5 rounded-xl font-black text-xs uppercase hover:bg-slate-200 transition-colors">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-green-600 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95">💾 Confirmar Execução</button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Preventivas;