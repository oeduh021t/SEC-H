import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // 🗓️ Padrão: Últimos 30 dias
    const dataAtual = new Date().toISOString().split('T')[0];
    const data30DiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [dataInicio, setDataInicio] = useState(data30DiasAtras);
    const [dataFim, setDataFim] = useState(dataAtual);
    const [periodoAtivo, setPeriodoAtivo] = useState('30d');

    const API_URL = 'http://192.168.5.101:3000/api';
    const nivelUsuario = user?.nivel?.toLowerCase().trim() || 'usuario';

    const carregarStats = useCallback(async (inicio = dataInicio, fim = dataFim) => {
        if (nivelUsuario === 'usuario') return;

        setLoading(true);
        let urlParams = '';
        if (inicio && fim) {
            urlParams = `?data_inicio=${inicio}&data_fim=${fim}`;
        }

        try {
            const res = await fetch(`${API_URL}/stats${urlParams}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'x-usuario-nivel': user?.nivel || ''
                }
            });
            if (!res.ok) throw new Error(`Erro na API: Código ${res.status}`);
            const data = await res.json();
            setStats(data);
        } catch (err) {
            console.error("Erro ao carregar stats da Dashboard:", err);
        } finally {
            setLoading(false);
        }
    }, [API_URL, user, nivelUsuario, dataInicio, dataFim]);

    useEffect(() => {
        carregarStats();
    }, [carregarStats]);

    const handleFiltrar = (e) => {
        e.preventDefault();
        setPeriodoAtivo('custom');
        carregarStats(dataInicio, dataFim);
    };

    const handleAtalhoPeriodo = (dias, tag) => {
        setPeriodoAtivo(tag);
        if (dias === 'todos') {
            setDataInicio('');
            setDataFim('');
            carregarStats('', '');
            return;
        }

        const fim = new Date().toISOString().split('T')[0];
        const inicio = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        setDataInicio(inicio);
        setDataFim(fim);
        carregarStats(inicio, fim);
    };

    if (nivelUsuario === 'usuario') {
        return (
            <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">
                Acesso Negado: Seu perfil não possui acesso ao painel estatístico.
            </div>
        );
    }

    if (loading && !stats) {
        return (
            <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
                Carregando indicadores da Engenharia Clínica...
            </div>
        );
    }

    // --- CONFIGURAÇÃO DOS DADOS DOS GRÁFICOS ---
    const dataEquipamentos = {
        labels: stats?.porEquipamento?.map(e => e.nome) || [],
        datasets: [{
            label: 'Chamados no Período',
            data: stats?.porEquipamento?.map(e => e.total) || [],
            backgroundColor: [
                'rgba(239, 68, 68, 0.85)',
                'rgba(249, 115, 22, 0.85)',
                'rgba(245, 158, 11, 0.85)',
                'rgba(59, 130, 246, 0.85)',
                'rgba(99, 102, 241, 0.85)'
            ],
            borderColor: ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#6366f1'],
            borderWidth: 1,
            borderRadius: 8,
            barThickness: 22,
        }]
    };

    const dataTecnicos = {
        labels: stats?.porTecnico?.map(t => t.nome) || [],
        datasets: [{
            label: 'OSs Finalizadas / Atendidas',
            data: stats?.porTecnico?.map(t => t.total) || [],
            backgroundColor: 'rgba(59, 130, 246, 0.85)',
            borderRadius: 6,
            barThickness: 16,
        }]
    };

    const optionsEquipamentos = {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { 
            legend: { display: false },
            tooltip: {
                padding: 12,
                titleFont: { size: 12, weight: 'bold' },
                bodyFont: { size: 12 }
            }
        },
        layout: { padding: { left: 10, right: 30, top: 10, bottom: 10 } },
        scales: {
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11, weight: 'bold' }, stepSize: 1 } },
            y: { 
                grid: { display: false }, 
                ticks: { 
                    font: { size: 11, weight: 'bold' },
                    color: '#334155',
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        if (label && label.length > 38) return label.substring(0, 35) + '...';
                        return label;
                    }
                } 
            }
        }
    };

    const optionsTecnicos = {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: { right: 25, left: 10 } },
        scales: {
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10, weight: 'bold' }, stepSize: 1 } },
            y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#334155', autoSkip: false } }
        }
    };

    const formatarMoeda = (valor) => {
        return new Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const totalAbertos = Number(stats?.chamadosAbertos?.[0]?.total || 0);
    const totalAndamento = Number(stats?.chamadosAndamento?.[0]?.total || 0);
    const totalConcluidos = Number(stats?.chamadosConcluidos?.[0]?.total || 0);
    const totalGeralChamados = totalAbertos + totalAndamento + totalConcluidos;
    const taxaResolucao = totalGeralChamados > 0 ? Math.round((totalConcluidos / totalGeralChamados) * 100) : 100;

    return (
        <div className="space-y-6 animate-in fade-in duration-300 w-full pb-10">
            
            {/* HEADER DO DASHBOARD */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2.5">
                        <span className="bg-blue-500 p-2 rounded-2xl text-white text-base">📊</span>
                        Painel de Controle
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                        Hospital Domingos Lourenço — Gestão Operacional & Engenharia Clínica
                    </p>
                </div>

                {/* FILTROS DE DATA & ATALHOS RÁPIDOS */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
                    
                    {/* Botões de Atalho */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl">
                        <button
                            type="button"
                            onClick={() => handleAtalhoPeriodo(7, '7d')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${periodoAtivo === '7d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            7 Dias
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAtalhoPeriodo(30, '30d')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${periodoAtivo === '30d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            30 Dias
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAtalhoPeriodo(90, '90d')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${periodoAtivo === '90d' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            90 Dias
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAtalhoPeriodo('todos', 'todos')}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${periodoAtivo === 'todos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Geral
                        </button>
                    </div>

                    <form onSubmit={handleFiltrar} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                        <input
                            type="date"
                            value={dataInicio}
                            onChange={e => setDataInicio(e.target.value)}
                            className="p-1 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-800 outline-none"
                        />
                        <span className="text-slate-400 text-xs font-bold">até</span>
                        <input
                            type="date"
                            value={dataFim}
                            onChange={e => setDataFim(e.target.value)}
                            className="p-1 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-800 outline-none"
                        />
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all shadow-sm"
                        >
                            🔍
                        </button>
                    </form>
                </div>
            </div>

            {/* INDICADORES OPERACIONAIS (CARDS TOPO) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard title="Total Ativos" value={stats?.totalEquipamentos?.[0]?.total || 0} icon="⚙️" color="border-blue-500" link="/equipamentos" />
                <StatCard title="Atenção PMOC" value={stats?.preventivasAtrasadas?.[0]?.total || 0} icon="⚠️" color="border-amber-500" link="/preventivas" />
                <StatCard title="OS Abertas" value={totalAbertos} icon="🔴" color="border-red-500" link="/chamados" />
                <StatCard title="Em Atendimento" value={totalAndamento} icon="🟡" color="border-amber-400" link="/chamados" />
                <StatCard title="Concluídas" value={totalConcluidos} icon="🟢" color="border-emerald-500" link="/chamados" />
                
                {/* TAXA DE RESOLUÇÃO */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 border-l-[6px] border-indigo-500 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolução</h6>
                        <span className="text-sm">🎯</span>
                    </div>
                    <div className="mt-1">
                        <span className="text-2xl font-black text-indigo-600">{taxaResolucao}%</span>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Eficácia OSs</p>
                    </div>
                </div>
            </div>

            {/* SEÇÃO DE BALANÇO FINANCEIRO */}
            <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span>💳</span> Balanço de Custos do Período {dataInicio && dataFim ? `(${new Date(dataInicio).toLocaleDateString('pt-BR')} à ${new Date(dataFim).toLocaleDateString('pt-BR')})` : '(Acumulado Geral)'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FinanceCard title="Gastos com Insumos / Peças" value={formatarMoeda(stats?.gastoInsumosGerais)} subtitle="Materiais deduzidos do estoque em manutenções" color="border-indigo-500" bgGradient="from-indigo-50/40" />
                    <FinanceCard title="Custo de Máquinas & Equipamentos" value={formatarMoeda(stats?.gastoTotalEquipamentos)} subtitle="Patrimônio em operação no parque tecnológico" color="border-emerald-500" bgGradient="from-emerald-50/40" />
                    <FinanceCard title="Reparos Prediais & Estrutura" value={formatarMoeda(stats?.gastoTotalEstrutura)} subtitle="Manutenções em leitos, salas e infraestrutura" color="border-purple-500" bgGradient="from-purple-50/40" />
                </div>
            </div>

            {/* GRÁFICOS & ATIVIDADES */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* LADO ESQUERDO: ATIVOS CRÍTICOS */}
                <div className="xl:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[460px]">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🚨</span> Ativos Mais Críticos (Top 5 Chamados)
                            </h3>
                            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Equipamentos com maior reincidência de falhas no período</p>
                        </div>
                        <Link to="/relatorios/inventario" className="text-[10px] font-black text-blue-600 hover:underline uppercase">Ver Inventário ↗</Link>
                    </div>
                    
                    <div className="flex-1 w-full min-h-[360px]">
                        <Bar data={dataEquipamentos} options={optionsEquipamentos} />
                    </div>
                </div>

                {/* LADO DIREITO: DESEMPENHO E FEED DE ATUALIZAÇÕES */}
                <div className="xl:col-span-5 space-y-6 flex flex-col justify-between">
                    
                    {/* GRÁFICO DESEMPENHO TÉCNICOS */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[250px]">
                        <div className="flex justify-between items-center mb-3 border-b border-slate-50 pb-2">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                <span>👨‍🔧</span> Atendimentos por Técnico
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{stats?.porTecnico?.length || 0} Operadores</span>
                        </div>
                        <div className="flex-1 w-full min-h-[190px]">
                            <Bar data={dataTecnicos} options={optionsTecnicos} />
                        </div>
                    </div>

                    {/* FEED DE ÚLTIMAS ATUALIZAÇÕES */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <span>📋</span> Últimas OS do Período
                            </h3>
                            <Link to="/chamados" className="text-[10px] font-black text-blue-600 hover:underline uppercase">Ver Todas ↗</Link>
                        </div>
                        <div className="divide-y divide-slate-100 p-2 max-h-48 overflow-y-auto">
                            {stats?.recentes?.map(r => (
                                <div key={r.id} className="p-2.5 hover:bg-slate-50 transition-colors flex justify-between items-center rounded-xl">
                                    <div className="min-w-0 flex-1 mr-2">
                                        <p className="text-xs font-bold text-slate-800 truncate">{r.titulo}</p>
                                        <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                                            #{r.id} • {new Date(r.data_abertura).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                        r.status === 'Aberto' ? 'bg-red-100 text-red-700 border border-red-200' : 
                                        r.status === 'Em Atendimento' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                                        'bg-green-100 text-green-700 border border-green-200'
                                    }`}>
                                        {r.status}
                                    </span>
                                </div>
                            ))}
                            {(!stats?.recentes || stats.recentes.length === 0) && (
                                <p className="text-xs text-slate-400 font-bold italic text-center py-4">Nenhum chamado registrado no período.</p>
                            )}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

const StatCard = ({ title, value, color, link, icon }) => (
    <Link to={link} className={`bg-white p-5 rounded-3xl shadow-sm border border-slate-100 border-l-[6px] ${color} hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col justify-between min-h-[100px]`}>
        <div className="flex justify-between items-start">
            <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h6>
            <span className="text-sm">{icon}</span>
        </div>
        <p className="text-2xl font-black text-slate-800 tracking-tight mt-1">{value}</p>
    </Link>
);

const FinanceCard = ({ title, value, subtitle, color, bgGradient }) => (
    <div className={`bg-gradient-to-br ${bgGradient} to-white bg-white p-5 rounded-3xl shadow-sm border border-slate-100 border-l-[6px] ${color} transition-all flex flex-col justify-between min-h-[110px]`}>
        <div>
            <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</h6>
            <p className="text-xl font-black text-slate-900 tracking-tight font-mono mt-1">{value}</p>
        </div>
        <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">{subtitle}</p>
    </div>
);

export default Dashboard;