import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState(null);
    const API_URL = 'http://192.168.5.101:3000/api';

    // Normaliza o nível de privilégio para checagem segura
    const nivelUsuario = user?.nivel?.toLowerCase().trim() || 'usuario';

    useEffect(() => {
        // Se for um usuário solicitante comum, barra a chamada à API antes de estourar o erro 403
        if (nivelUsuario === 'usuario') return;

        fetch(`${API_URL}/stats`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-usuario-nivel': user?.nivel || '' // Injeção de segurança contra Erro 401
            }
        })
            .then(res => {
                if (!res.ok) throw new Error(`Erro na API: Código ${res.status}`);
                return res.json();
            })
            .then(data => setStats(data))
            .catch(err => console.error("Erro ao carregar stats da Dashboard:", err));
    }, [API_URL, user, nivelUsuario]);

    // Bloqueio preventivo caso um Solicitante force a URL da dashboard pela barra de endereços
    if (nivelUsuario === 'usuario') {
        return <div className="p-10 text-center font-bold text-red-500 uppercase text-xs tracking-widest">Acesso Negado: Seu perfil não possui acesso ao painel estatístico.</div>;
    }

    if (!stats) return <div className="p-10 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">Carregando Painel...</div>;

    // --- CONFIGURAÇÃO DOS DADOS ---

    const dataSetores = {
        labels: stats.porSetor?.map(s => s.nome) || [],
        datasets: [{
            data: stats.porSetor?.map(s => s.total) || [],
            backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#f43f5e', '#84cc16'],
            borderWidth: 0,
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

    // --- OPÇÕES DOS GRÁFICOS ---

    const optionsSetores = {
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    boxWidth: 10,
                    font: { size: 10, weight: 'bold' },
                    padding: 15
                }
            }
        },
        cutout: '70%'
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Painel de Controle</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest italic">Olá, {user?.nome?.split(' ')[0] || 'Usuário'}</p>
                </div>
            </div>

            {/* INDICADORES (CARDS) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard title="Total Ativos" value={stats.totalEquipamentos?.[0]?.total || 0} color="border-blue-500" link="/equipamentos" />
                <StatCard title="Preventivas" value={stats.preventivasAtrasadas?.[0]?.total || 0} color="border-green-500" link="/preventivas" />
                <StatCard title="Abertos" value={stats.chamadosAbertos?.[0]?.total || 0} color="border-red-500" link="/chamados" />
                <StatCard title="Em Atendimento" value={stats.chamadosAndamento?.[0]?.total || 0} color="border-amber-500" link="/chamados" />
                <StatCard title="Concluídos" value={stats.chamadosConcluidos?.[0]?.total || 0} color="border-emerald-500" link="/chamados" />
            </div>

            {/* SEÇÃO DE GRÁFICOS E RECENTES */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

                {/* Gráfico de Setores (2 colunas) */}
                <div className="xl:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Incidentes por Setor</h3>
                    <div className="flex-1 min-h-[300px]">
                        <Doughnut data={dataSetores} options={optionsSetores} />
                    </div>
                </div>

                {/* Desempenho da Equipe (1 coluna) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Desempenho da Equipe</h3>
                    <div className="flex-1 min-h-[300px]">
                        <Bar data={dataTecnicos} options={optionsTecnicos} />
                    </div>
                </div>

                {/* Últimas Atualizações (1 coluna) */}
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

export default Dashboard;