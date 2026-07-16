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
                Carregando Painel...
            </div>
        );
    }

    // --- CONFIGURAÇÃO DOS DADOS DOS GRÁFICOS ---
    
    // 🆕 GRÁFICO: Equipamentos mais Críticos (Com Cores Distintas e Evitando Cortes de Texto)
    const dataEquipamentos = {
        labels: stats.porEquipamento?.map(e => e.nome) || [],
        datasets: [{
            label: 'Chamados',
            data: stats.porEquipamento?.map(e => e.total) || [],
            // Paleta térmica do mais crítico (vermelho) para o menos crítico (cinza slate)
            backgroundColor: [
                'rgba(239, 68, 68, 0.75)',   // Vermelho vivo (1º Lugar)
                'rgba(249, 115, 22, 0.75)',  // Laranja (2º Lugar)
                'rgba(245, 158, 11, 0.75)',  // Âmbar (3º Lugar)
                'rgba(59, 130, 246, 0.75)',  // Azul (4º Lugar)
                'rgba(100, 116, 139, 0.75)'  // Cinza Slate (5º Lugar)
            ],
            borderColor: [
                '#ef4444',
                '#f97316',
                '#f59e0b',
                '#3b82f6',
                '#64748b'
            ],
            borderWidth: 1,
            borderRadius: 6,
            barThickness: 24, // Controla o tamanho da barra no container
        }]
    };

    const dataTecnicos = {
        labels: stats.porTecnico?.map(t => t.nome) || [],
        datasets: [{
            label: 'Chamados',
            data: stats.porTecnico?.map(t => t.total) || [],
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderRadius: 8,
        }]
    };

    // 🆕 OPÇÕES: Evita corte de texto aplicando recuo interno e limitador de string
    const optionsEquipamentos = {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { 
            legend: { display: false } 
        },
        layout: {
            padding: {
                left: 10,  // Margem segura para renderização das labels
                right: 20
            }
        },
        scales: {
            x: { 
                grid: { display: false }, 
                ticks: { 
                    font: { size: 10 },
                    stepSize: 1 // Força números inteiros no contador de chamados (ex: 1, 2, 3...)
                } 
            },
            y: { 
                grid: { display: false }, 
                ticks: { 
                    font: { size: 9, weight: 'bold' }, // Fonte levemente menor para garantir o espaço
                    color: '#334155',
                    // Reduz strings excessivamente longas para caber perfeitamente na viewport
                    callback: function(value) {
                        const label = this.getLabelForValue(value);
                        if (label && label.length > 32) {
                            return label.substring(0, 29) + '...';
                        }
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
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' } } }
        }
    };

    const formatarMoeda = (valor) => {
        return new Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Painel de Controle</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Olá, {user?.nome?.split(' ')[0] || 'Usuário'}</p>
                </div>
            </div>

            {/* INDICADORES OPERACIONAIS */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard title="Total Ativos" value={stats.totalEquipamentos?.[0]?.total || 0} color="border-blue-500" link="/equipamentos" />
                
                {/* 🛠️ ALTERADO: Mudamos o título para 'Em Atenção (15d)' e a cor para border-amber-500 */}
                <StatCard title="Em Atenção (15d)" value={stats.preventivasAtrasadas?.[0]?.total || 0} color="border-amber-500" link="/preventivas" />
                
                <StatCard title="Abertos" value={stats.chamadosAbertos?.[0]?.total || 0} color="border-red-500" link="/chamados" />
                <StatCard title="Em Atendimento" value={stats.chamadosAndamento?.[0]?.total || 0} color="border-amber-500" link="/chamados" />
                <StatCard title="Concluídos" value={stats.chamadosConcluidos?.[0]?.total || 0} color="border-emerald-500" link="/chamados" />
            </div>

            {/* LINHA DE CONTROLE DE GASTOS FINANCEIROS */}
            <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Balanço Financeiro (Mês Atual)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FinanceCard title="Gastos com Insumos Gerais" value={formatarMoeda(stats.gastoInsumosGerais)} color="border-indigo-500" />
                    <FinanceCard title="Total em Equipamentos" value={formatarMoeda(stats.gastoTotalEquipamentos)} color="border-emerald-500" />
                    <FinanceCard title="Total em Estrutura" value={formatarMoeda(stats.gastoTotalEstrutura)} color="border-purple-500" />
                </div>
            </div>

            {/* SEÇÃO DE GRÁFICOS E RECENTES */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                
                {/* GRÁFICO REFORMULADO: ATIVOS MAIS CRÍTICOS (TOP 5) */}
                <div className="xl:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ativos Mais Críticos (Top 5 Chamados)</h3>
                    <div className="flex-1 min-h-[300px]">
                        <Bar data={dataEquipamentos} options={optionsEquipamentos} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Desempenho da Equipe</h3>
                    <div className="flex-1 min-h-[300px]">
                        <Bar data={dataTecnicos} options={optionsTecnicos} />
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <h3 className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b text-center">Últimas Atualizações</h3>
                    <div className="flex-1 overflow-y-auto max-h-[320px] divide-y divide-slate-50">
                        {stats.recentes?.map(r => (
                            <div key={r.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                <div className="min-w-0 flex-1 mr-2">
                                    <p className="text-xs font-bold text-slate-700 truncate">{r.titulo}</p>
                                    <p className="text-[9px] text-slate-400 font-black tracking-tighter">
                                        {new Date(r.data_abertura).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase shrink-0 ${
                                    r.status === 'Aberto' ? 'bg-red-500 text-white' : 
                                    r.status === 'Em Atendimento' ? 'bg-amber-400 text-white' : 
                                    'bg-green-500 text-white'
                                }`}>
                                    {r.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, color, link }) => (
    <Link to={link} className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${color} hover:-translate-y-1 transition-all`}>
        <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h6>
        <p className="text-2xl font-black text-slate-800 tracking-tighter">{value}</p>
    </Link>
);

const FinanceCard = ({ title, value, color }) => (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${color} transition-all`}>
        <h6 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h6>
        <p className="text-xl font-black text-slate-900 tracking-tight font-mono">{value}</p>
    </div>
);

export default Dashboard;