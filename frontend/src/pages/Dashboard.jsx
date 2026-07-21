import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState(null);
    const API_URL = 'http://192.168.5.101:3000/api';

    const nivelUsuario = user?.nivel?.toLowerCase().trim() || 'usuario';

    useEffect(() => {
        if (nivelUsuario === 'usuario') return;

        fetch(`${API_URL}/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-usuario-nivel': user?.nivel || ''
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(`Erro na API: Código ${res.status}`);
                return res.json();
            })
            .then(data => setStats(data))
            .catch(err => console.error("Erro ao carregar stats da Dashboard:", err));
    }, [API_URL, user, nivelUsuario]);

    if (nivelUsuario === 'usuario') {
        return (
            <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">
                Acesso Negado: Seu perfil não possui acesso ao painel estatístico.
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="p-10 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
                Carregando Painel Estatístico...
            </div>
        );
    }

    // --- CONFIGURAÇÃO DOS DADOS DOS GRÁFICOS ---
    
    const dataEquipamentos = {
        labels: stats.porEquipamento?.map(e => e.nome) || [],
        datasets: [{
            label: 'Chamados',
            data: stats.porEquipamento?.map(e => e.total) || [],
            backgroundColor: [
                'rgba(239, 68, 68, 0.85)',   // Vermelho
                'rgba(249, 115, 22, 0.85)',  // Laranja
                'rgba(245, 158, 11, 0.85)',  // Âmbar
                'rgba(59, 130, 246, 0.85)',  // Azul
                'rgba(100, 116, 139, 0.85)'  // Cinza
            ],
            borderColor: ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#64748b'],
            borderWidth: 1,
            borderRadius: 8,
            barThickness: 28,
        }]
    };

    // 🛠️ CORRIGIDO: Barras com espessura fixa e raio suave para evitar deformação visual
    const dataTecnicos = {
        labels: stats.porTecnico?.map(t => t.nome) || [],
        datasets: [{
            label: 'Chamados',
            data: stats.porTecnico?.map(t => t.total) || [],
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderRadius: 4,
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
        layout: {
            padding: { left: 10, right: 30, top: 10, bottom: 10 }
        },
        scales: {
            x: { 
                grid: { color: '#f1f5f9' }, 
                ticks: { font: { size: 11, weight: 'bold' }, stepSize: 1 } 
            },
            y: { 
                grid: { display: false }, 
                ticks: { 
                    font: { size: 11, weight: 'bold' },
                    color: '#334155',
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        if (label && label.length > 30) {
                            return label.substring(0, 27) + '...';
                        }
                        return label;
                    }
                } 
            }
        }
    };

    // 🛠️ CORRIGIDO: autoSkip desativado para forçar a exibição de todos os técnicos sem pular nomes
    const optionsTecnicos = {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        layout: { padding: { right: 20, left: 10 } },
        scales: {
            x: { 
                grid: { color: '#f1f5f9' }, 
                ticks: { font: { size: 10 } } 
            },
            y: { 
                grid: { display: false }, 
                ticks: { 
                    font: { size: 10, weight: 'bold' }, 
                    color: '#334155',
                    autoSkip: false
                } 
            }
        }
    };

    const formatarMoeda = (valor) => {
        return new Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 w-full pb-10">
            
            {/* HEADER DA DASHBOARD */}
            <div className="flex justify-between items-end bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-3">
                        <span className="bg-blue-100 p-2 rounded-2xl text-blue-600 text-2xl">📊</span>
                        Painel de Controle
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Visão Geral e Indicadores Operacionais da Engenharia Clínica — Olá, <span className="text-blue-600">{user?.nome?.split(' ')[0] || 'Usuário'}</span>
                    </p>
                </div>
                <div className="text-right hidden sm:block">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Última Atualização</span>
                    <span className="text-xs font-mono font-bold text-slate-700">{new Date().toLocaleString('pt-BR')}</span>
                </div>
            </div>

            {/* INDICADORES OPERACIONAIS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                <StatCard title="Total Ativos" value={stats.totalEquipamentos?.[0]?.total || 0} icon="⚙️" color="border-blue-500" link="/equipamentos" />
                <StatCard title="Em Atenção (15d)" value={stats.preventivasAtrasadas?.[0]?.total || 0} icon="⚠️" color="border-amber-500" link="/preventivas" />
                <StatCard title="Abertos" value={stats.chamadosAbertos?.[0]?.total || 0} icon="🔴" color="border-red-500" link="/chamados" />
                <StatCard title="Em Atendimento" value={stats.chamadosAndamento?.[0]?.total || 0} icon="🟡" color="border-amber-400" link="/chamados" />
                <StatCard title="Concluídos" value={stats.chamadosConcluidos?.[0]?.total || 0} icon="🟢" color="border-emerald-500" link="/chamados" />
            </div>

            {/* SEÇÃO DE BALANÇO FINANCEIRO */}
            <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span>💳</span> Balanço Financeiro (Mês Atual)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <FinanceCard title="Gastos com Insumos Gerais" value={formatarMoeda(stats.gastoInsumosGerais)} subtitle="Peças e materiais consumidos do estoque" color="border-indigo-500" bgGradient="from-indigo-50/40" />
                    <FinanceCard title="Total em Equipamentos" value={formatarMoeda(stats.gastoTotalEquipamentos)} subtitle="Patrimônio ativo em máquinas do hospital" color="border-emerald-500" bgGradient="from-emerald-50/40" />
                    <FinanceCard title="Total em Estrutura" value={formatarMoeda(stats.gastoTotalEstrutura)} subtitle="Reparos prediais e infraestrutura de setores" color="border-purple-500" bgGradient="from-purple-50/40" />
                </div>
            </div>

            {/* SEÇÃO PRINCIPAL DE GRÁFICOS E ATIVIDADE RECENTE */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                
                {/* LADO ESQUERDO: GRÁFICO DE ATIVOS MAIS CRÍTICOS */}
                <div className="xl:col-span-7 bg-white p-7 rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[580px]">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                🚨 Ativos Mais Críticos (Top 5 Chamados)
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Equipamentos com maior volume de manutenções abertas</p>
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-[480px]">
                        <Bar data={dataEquipamentos} options={optionsEquipamentos} />
                    </div>
                </div>

                {/* LADO DIREITO: DESEMPENHO E FEED DE ATUALIZAÇÕES */}
                <div className="xl:col-span-5 space-y-6 flex flex-col justify-between">
                    
                    {/* 🛠️ CORRIGIDO: Container com altura min-h-[340px] para comportar todas as barras sem amassar */}
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col min-h-[340px]">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            👨‍🔧 Desempenho da Equipe
                        </h3>
                        <div className="flex-1 w-full h-full min-h-[260px]">
                            <Bar data={dataTecnicos} options={optionsTecnicos} />
                        </div>
                    </div>

                    {/* FEED DE ÚLTIMAS ATUALIZAÇÕES */}
                    <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[220px]">
                        <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <span>📋</span> Últimas Atualizações de OS
                            </h3>
                            <Link to="/chamados" className="text-[10px] font-black text-blue-600 hover:underline uppercase">Ver Todas ↗</Link>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                            {stats.recentes?.map(r => (
                                <div key={r.id} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center rounded-xl">
                                    <div className="min-w-0 flex-1 mr-3">
                                        <p className="text-xs font-bold text-slate-800 truncate">{r.titulo}</p>
                                        <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                                            #{r.id} • {new Date(r.data_abertura).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                        r.status === 'Aberto' ? 'bg-red-100 text-red-700 border border-red-200' : 
                                        r.status === 'Em Atendimento' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                                        'bg-green-100 text-green-700 border border-green-200'
                                    }`}>
                                        {r.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

// --- COMPONENTES AUXILIARES DE CARDS DE ALTO IMPACTO VISUAL ---

const StatCard = ({ title, value, color, link, icon }) => (
    <Link to={link} className={`bg-white p-6 rounded-3xl shadow-sm border-l-[6px] ${color} hover:-translate-y-1 hover:shadow-md transition-all flex flex-col justify-between min-h-[110px]`}>
        <div className="flex justify-between items-start">
            <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</h6>
            <span className="text-base">{icon}</span>
        </div>
        <p className="text-3xl font-black text-slate-800 tracking-tight mt-2">{value}</p>
    </Link>
);

const FinanceCard = ({ title, value, subtitle, color, bgGradient }) => (
    <div className={`bg-gradient-to-br ${bgGradient} to-white bg-white p-6 rounded-3xl shadow-sm border-l-[6px] ${color} transition-all flex flex-col justify-between min-h-[120px]`}>
        <div>
            <h6 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</h6>
            <p className="text-2xl font-black text-slate-900 tracking-tight font-mono mt-1">{value}</p>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">{subtitle}</p>
    </div>
);

export default Dashboard;