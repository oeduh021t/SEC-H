import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

const Dashboard = ({ user }) => {
    const [visaoAtual, setVisaoAtual] = useState('tecnica');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const dataAtual = new Date().toISOString().split('T')[0];
    const data30DiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [dataInicio, setDataInicio] = useState(data30DiasAtras);
    const [dataFim, setDataFim] = useState(dataAtual);
    const [periodoAtivo, setPeriodoAtivo] = useState('30d');

    const API_URL = '/api';
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
                Carregando indicadores operacionais...
            </div>
        );
    }

    const asArray = (val) => (Array.isArray(val) ? val : []);
    
    const formatarMinutosParaHoras = (minutosTotais) => {
        if (!minutosTotais || minutosTotais <= 0) return '---';
        const h = Math.floor(minutosTotais / 60);
        const m = Math.round(minutosTotais % 60);
        if (h === 0) return `${m}m`;
        return `${h}h ${m > 0 ? `${m}m` : ''}`;
    };

    // Cálculos Operacionais
    const totalAbertos = Number(stats?.chamadosAbertos?.[0]?.total || 0);
    const totalAndamento = Number(stats?.chamadosAndamento?.[0]?.total || 0);
    const totalExternos = Number(stats?.chamadosExternos?.[0]?.total || asArray(stats?.recentes).filter(r => r.status === 'Aguardando Externa').length || 0);
    const totalConcluidos = Number(stats?.chamadosConcluidos?.[0]?.total || 0);
    const totalGeralChamados = totalAbertos + totalAndamento + totalExternos + totalConcluidos;
    const taxaResolucao = totalGeralChamados > 0 ? Math.round((totalConcluidos / totalGeralChamados) * 100) : 100;

    // Métricas de Auditoria ONA / Parque Tecnológico
    const uptimeCalculado = stats?.indicadoresQualidade?.[0]?.uptime_parque_taxa ?? (
        stats?.statusAtivos?.[0]?.total > 0
            ? (((Number(stats?.statusAtivos?.[0]?.ativos || 0) + Number(stats?.statusAtivos?.[0]?.reserva || 0)) / Number(stats?.statusAtivos?.[0]?.total)) * 100).toFixed(1)
            : '100.0'
    );
    const mttrCalculado = stats?.indicadoresQualidade?.[0]?.mttr_medio_horas ?? '0.0';

    // Métricas de SLA & TMA
    const slaStats = stats?.metricasSLA?.[0];
    const totalConcluidasSLA = Number(slaStats?.total_concluidas || 0);
    const dentroSla = Number(slaStats?.dentro_sla_total || 0);
    const percentualCumprimentoSLA = totalConcluidasSLA > 0 ? Math.round((dentroSla / totalConcluidasSLA) * 100) : 100;
    const tmaGeralTexto = formatarMinutosParaHoras(slaStats?.tma_minutos);

    // Cálculos Financeiros
    const gastoInsumos = Number(stats?.gastoInsumosGerais || 0);
    const gastoEquipamentos = Number(stats?.gastoTotalEquipamentos || 0);
    const gastoEstrutura = Number(stats?.gastoTotalEstrutura || 0);
    const custoOperacionalTotal = gastoInsumos + gastoEquipamentos + gastoEstrutura;

    // Métricas de Compras & Saving
    const savingStats = stats?.savingCompras?.[0] || { total_estimado: 0, total_real: 0, total_pedidos_baixados: 0 };
    const estimadoTotalCompras = Number(savingStats.total_estimado || 0);
    const realTotalCompras = Number(savingStats.total_real || 0);
    const diferencaSaving = estimadoTotalCompras - realTotalCompras; // Positivo = Economia (Saving), Negativo = Estouro
    const percentualSaving = estimadoTotalCompras > 0 ? ((diferencaSaving / estimadoTotalCompras) * 100).toFixed(1) : '0.0';

    // Dados Gráficos protegidos
    const dataEquipamentos = {
        labels: asArray(stats?.porEquipamento).map(e => e.nome),
        datasets: [{
            label: 'Chamados no Período',
            data: asArray(stats?.porEquipamento).map(e => e.total),
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
        labels: asArray(stats?.porTecnico).map(t => t.nome),
        datasets: [{
            label: 'OSs Finalizadas / Atendidas',
            data: asArray(stats?.porTecnico).map(t => t.total),
            backgroundColor: 'rgba(59, 130, 246, 0.85)',
            borderRadius: 6,
            barThickness: 16,
        }]
    };

    const dataAtivosPorSetor = {
        labels: asArray(stats?.ativosPorSetor).map(s => s.setor),
        datasets: [{
            label: 'Equipamentos Instalados',
            data: asArray(stats?.ativosPorSetor).map(s => s.total),
            backgroundColor: 'rgba(99, 102, 241, 0.85)',
            borderRadius: 6,
            barThickness: 16,
        }]
    };

    const dataTopPecas = {
        labels: asArray(stats?.topPecasConsumidas).map(p => p.nome),
        datasets: [{
            label: 'Quantidade Consumida',
            data: asArray(stats?.topPecasConsumidas).map(p => p.total_qtd),
            backgroundColor: 'rgba(245, 158, 11, 0.85)',
            borderRadius: 6,
            barThickness: 18,
        }]
    };

    const dataCustoSetor = {
        labels: asArray(stats?.custoPorSetor).map(s => s.setor),
        datasets: [{
            label: 'Custo Total Acumulado (R$)',
            data: asArray(stats?.custoPorSetor).map(s => s.total_gasto),
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6,
            barThickness: 18,
        }]
    };

    const optionsEquipamentos = {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11, weight: 'bold' }, stepSize: 1 } },
            y: { grid: { display: false }, ticks: { font: { size: 11, weight: 'bold' }, color: '#334155' } }
        }
    };

    const optionsTecnicos = {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10, weight: 'bold' }, stepSize: 1 } },
            y: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#334155' } }
        }
    };

    const formatarMoeda = (valor) => {
        return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 w-full pb-10">
            
            {/* HEADER DA DASHBOARD + CONTROLE DE PERÍODO */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2.5">
                        <span className="bg-blue-600 p-2 rounded-2xl text-white text-base">📊</span>
                        Painel de Controle
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">
                        Hospital Domingos Lourenço — Gestão Operacional & Engenharia Clínica
                    </p>
                </div>

                {/* FILTROS DE DATA & ATALHOS */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
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

            {/* 🧭 SELETOR DE VISÕES SEGMENTADAS */}
            <div className="flex bg-slate-200/80 p-1.5 rounded-2xl gap-1.5 w-full sm:w-fit overflow-x-auto shadow-inner border border-slate-300/40">
                <button 
                    type="button"
                    onClick={() => setVisaoAtual('tecnica')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${
                        visaoAtual === 'tecnica' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>🛠️</span> Visão Técnica (Bancada)
                </button>

                <button 
                    type="button"
                    onClick={() => setVisaoAtual('ativos')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${
                        visaoAtual === 'ativos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>🤖</span> Ativos & Parque
                </button>

                <button 
                    type="button"
                    onClick={() => setVisaoAtual('estoque')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${
                        visaoAtual === 'estoque' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>📦</span> Almoxarifado
                </button>

                <button 
                    type="button"
                    onClick={() => setVisaoAtual('financeira')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 whitespace-nowrap ${
                        visaoAtual === 'financeira' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <span>💼</span> Diretoria & Custos
                </button>
            </div>

            {/* ========================================================= */}
            {/* 🛠️ VISÃO 1: TÉCNICA (OPERACIONAL / ENGENHARIA CLÍNICA) */}
            {/* ========================================================= */}
            {visaoAtual === 'tecnica' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* KPIS DA BANCADA */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <StatCard title="OS Abertas" value={totalAbertos} icon="🔴" color="border-red-500" link="/chamados" />
                        <StatCard title="Em Atendimento" value={totalAndamento} icon="🟡" color="border-amber-400" link="/chamados" />
                        <StatCard title="Manut. Externa" value={totalExternos} icon="🚚" color="border-purple-600" link="/chamados" />
                        <StatCard title="Atenção PMOC" value={stats?.preventivasAtrasadas?.[0]?.total || 0} icon="⚠️" color="border-orange-500" link="/preventivas" />
                        <StatCard title="Concluídas" value={totalConcluidos} icon="🟢" color="border-emerald-500" link="/chamados" />

                        {/* Taxa de Eficácia */}
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

                    {/* BANNER DE PERFORMANCE TÉCNICA & SLA */}
                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                        <div className="flex items-center gap-3 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 pr-2">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold">
                                ⏱️
                            </div>
                            <div>
                                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tempo Médio Resolução</h6>
                                <p className="text-2xl font-black text-slate-800 tracking-tight mt-0.5">{tmaGeralTexto}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Do chamado aberto à baixa</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 border-b md:border-b-0 md:border-r border-slate-100 pb-3 md:pb-0 pr-2">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${
                                percentualCumprimentoSLA >= 90 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                                🎯
                            </div>
                            <div>
                                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aderência ao SLA</h6>
                                <p className={`text-2xl font-black tracking-tight mt-0.5 ${
                                    percentualCumprimentoSLA >= 90 ? 'text-emerald-600' : 'text-amber-600'
                                }`}>
                                    {percentualCumprimentoSLA}%
                                </p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">
                                    {dentroSla} de {totalConcluidasSLA} OS no prazo
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Médias por Criticidade</h6>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="bg-red-50 text-red-700 px-2 py-1 rounded-lg flex justify-between font-bold">
                                    <span>🚨 Urgente:</span>
                                    <span>{formatarMinutosParaHoras(slaStats?.tma_urgente_min)}</span>
                                </div>
                                <div className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg flex justify-between font-bold">
                                    <span>⚠️ Alta:</span>
                                    <span>{formatarMinutosParaHoras(slaStats?.tma_alta_min)}</span>
                                </div>
                                <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg flex justify-between font-bold">
                                    <span>🟡 Média:</span>
                                    <span>{formatarMinutosParaHoras(slaStats?.tma_media_min)}</span>
                                </div>
                                <div className="bg-slate-100 text-slate-700 px-2 py-1 rounded-lg flex justify-between font-bold">
                                    <span>⚪ Baixa:</span>
                                    <span>{formatarMinutosParaHoras(slaStats?.tma_baixa_min)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SEÇÃO PRINCIPAL DA VISÃO TÉCNICA */}
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[460px]">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>👨‍🔧</span> Carga Operacional por Técnico
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">OSs atendidas e finalizadas pela equipe</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{asArray(stats?.porTecnico).length} Operadores</span>
                            </div>
                            <div className="h-80 w-full">
                                <Bar data={dataTecnicos} options={optionsTecnicos} />
                            </div>
                        </div>

                        <div className="xl:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col justify-between min-h-[460px]">
                            <div>
                                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📋</span> Fila Recente da Bancada
                                    </h3>
                                    <Link to="/chamados" className="text-[10px] font-black text-blue-600 hover:underline uppercase">Ver Todas ↗</Link>
                                </div>

                                <div className="divide-y divide-slate-100 p-2 max-h-[390px] overflow-y-auto">
                                    {asArray(stats?.recentes).map(r => (
                                        <div key={r.id} className="p-3 hover:bg-slate-50 transition-colors flex justify-between items-center rounded-xl">
                                            <div className="min-w-0 flex-1 mr-2">
                                                <p className="text-xs font-bold text-slate-800 truncate">{r.titulo}</p>
                                                <p className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                                                    #{r.id} • {new Date(r.data_abertura).toLocaleDateString('pt-BR')}
                                                </p>
                                            </div>
                                            
                                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 ${
                                                r.status === 'Aguardando Externa' ? 'bg-purple-600 text-white' :
                                                r.status === 'Aberto' ? 'bg-red-500 text-white' :
                                                r.status === 'Em Atendimento' ? 'bg-amber-500 text-white' :
                                                'bg-emerald-600 text-white'
                                            }`}>
                                                {r.status}
                                            </span>
                                        </div>
                                    ))}

                                    {asArray(stats?.recentes).length === 0 && (
                                        <p className="text-xs text-slate-400 font-bold italic text-center py-6">Nenhum chamado registrado no período.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            )}

            {/* ========================================================= */}
            {/* 🤖 VISÃO 2: ATIVOS & PARQUE TECNOLÓGICO                    */}
            {/* ========================================================= */}
            {visaoAtual === 'ativos' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                        <StatCard 
                            title="Inventário Total" 
                            value={stats?.statusAtivos?.[0]?.total || stats?.totalEquipamentos?.[0]?.total || 0} 
                            icon="⚙️" 
                            color="border-blue-500" 
                            link="/equipamentos" 
                        />
                        <StatCard 
                            title="Operando Normal" 
                            value={stats?.statusAtivos?.[0]?.ativos || 0} 
                            icon="🟢" 
                            color="border-emerald-500" 
                            link="/equipamentos" 
                        />
                        <StatCard 
                            title="Em Manutenção" 
                            value={stats?.statusAtivos?.[0]?.manutencao || totalExternos} 
                            icon="🟡" 
                            color="border-amber-400" 
                            link="/equipamentos" 
                        />
                        <StatCard 
                            title="Reserva Técnica" 
                            value={stats?.statusAtivos?.[0]?.reserva || 0} 
                            icon="🔵" 
                            color="border-cyan-500" 
                            link="/equipamentos" 
                        />
                        <StatCard 
                            title="Inoperantes" 
                            value={stats?.statusAtivos?.[0]?.inoperantes || 0} 
                            icon="🔴" 
                            color="border-rose-500" 
                            link="/equipamentos" 
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[440px]">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🚨</span> Top 5 Ativos Críticos / Reincidentes
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Equipamentos com maior índice de quebra no período</p>
                                </div>
                                <Link to="/equipamentos" className="text-[10px] font-black text-blue-600 hover:underline uppercase">Ver Todos ↗</Link>
                            </div>
                            <div className="h-72 w-full">
                                <Bar data={dataEquipamentos} options={optionsEquipamentos} />
                            </div>
                        </div>

                        <div className="xl:col-span-5 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[440px]">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📍</span> Densidade por Setor Hospitalar
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Concentração de ativos por unidade</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Top 6 Setores</span>
                            </div>
                            <div className="h-72 w-full">
                                <Bar data={dataAtivosPorSetor} options={optionsTecnicos} />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-sm border-2 border-purple-100 overflow-hidden">
                        <div className="p-4 bg-purple-50/70 border-b border-purple-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>🚚</span> Ativos sob Custódia Externa / Assistência Autorizada ({totalExternos})
                                </h3>
                                <p className="text-[9px] font-bold text-purple-700 uppercase mt-0.5">
                                    Equipamentos fora da unidade hospitalar aguardando laudo técnico ou retorno
                                </p>
                            </div>
                            <Link to="/chamados" className="text-[10px] font-black text-purple-700 hover:underline uppercase">
                                Filtrar na Lista ↗
                            </Link>
                        </div>
                        
                        <div className="divide-y divide-slate-100 p-2 max-h-56 overflow-y-auto">
                            {asArray(stats?.recentes).filter(r => r.status === 'Aguardando Externa').map(ext => (
                                <div key={ext.id} className="p-3 hover:bg-purple-50/40 transition-colors flex justify-between items-center rounded-xl">
                                    <div className="min-w-0 flex-1 mr-2">
                                        <p className="text-xs font-bold text-slate-800 truncate">{ext.titulo}</p>
                                        <p className="text-[10px] text-purple-600 font-bold mt-0.5">
                                            OS #{ext.id} • Fornecedor: {ext.fornecedor_nome || 'Terceirizado Homologado'}
                                        </p>
                                    </div>
                                    <Link 
                                        to={`/chamados/${ext.id}/tratar`}
                                        className="px-3 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-purple-700 transition-colors shadow-xs"
                                    >
                                        Dar Entrada
                                    </Link>
                                </div>
                            ))}

                            {asArray(stats?.recentes).filter(r => r.status === 'Aguardando Externa').length === 0 && (
                                <p className="text-xs text-slate-400 font-bold italic text-center py-6">
                                    Nenhum equipamento externo no momento. Parque interno 100% assistido na unidade.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-800/60 px-2.5 py-0.5 rounded-full inline-block">
                                🛡️ Engenharia Hospitalar & Auditoria
                            </span>
                            <h4 className="text-sm font-black uppercase">Disponibilidade Operacional do Parque</h4>
                            <p className="text-xs text-slate-300 font-medium">
                                Acompanhamento de segurança do paciente baseado na prontidão de equipamentos de suporte à vida.
                            </p>
                        </div>
                        <div className="flex gap-6 text-center shrink-0">
                            <div>
                                <span className="text-2xl font-black text-emerald-400">{uptimeCalculado}%</span>
                                <p className="text-[9px] font-bold text-slate-300 uppercase">Uptime Geral</p>
                            </div>
                            <div className="border-l border-indigo-800 pl-6">
                                <span className="text-2xl font-black text-cyan-400">{mttrCalculado}h</span>
                                <p className="text-[9px] font-bold text-slate-300 uppercase">MTTR Médio</p>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* ========================================================= */}
            {/* 📦 VISÃO 3: ALMOXARIFADO & ESTOQUE                        */}
            {/* ========================================================= */}
            {visaoAtual === 'estoque' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FinanceCard 
                            title="Valor Total do Almoxarifado" 
                            value={formatarMoeda(stats?.valorTotalAlmoxarifado)} 
                            subtitle="Capital físico imobilizado nas prateleiras" 
                            color="border-blue-500" 
                            bgGradient="from-blue-50/40" 
                        />
                        <FinanceCard 
                            title="Gastos com Peças em OS" 
                            value={formatarMoeda(stats?.gastoInsumosGerais)} 
                            subtitle="Materiais deduzidos nos chamados do período" 
                            color="border-indigo-500" 
                            bgGradient="from-indigo-50/40" 
                        />
                        <FinanceCard 
                            title="Reparos Prediais / Consumo" 
                            value={formatarMoeda(stats?.gastoTotalEstrutura)} 
                            subtitle="Materiais elétricos, hidráulicos e estrutura" 
                            color="border-amber-500" 
                            bgGradient="from-amber-50/40" 
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[440px]">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>📊</span> Insumos com Maior Giro / Consumo em OS
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Top peças mais aplicadas pela equipe técnica</p>
                                </div>
                                <Link to="/estoque" className="text-[10px] font-black text-blue-600 hover:underline uppercase">Ver Estoque ↗</Link>
                            </div>
                            <div className="h-72 w-full">
                                <Bar data={dataTopPecas} options={optionsTecnicos} />
                            </div>
                        </div>

                        <div className="xl:col-span-5 bg-white rounded-3xl shadow-sm border-2 border-amber-100 overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="p-4 bg-amber-50/70 border-b border-amber-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>⚠️</span> Ponto de Pedido / Estoque Crítico
                                        </h3>
                                        <p className="text-[9px] font-bold text-amber-700 uppercase mt-0.5">Itens atingindo o limite de segurança</p>
                                    </div>
                                    <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                                        {asArray(stats?.itensAbaixoMinimo).length} Itens
                                    </span>
                                </div>

                                <div className="divide-y divide-slate-100 p-2 max-h-[380px] overflow-y-auto">
                                    {asArray(stats?.itensAbaixoMinimo).map(item => (
                                        <div key={item.id} className="p-3 hover:bg-amber-50/30 transition-colors flex justify-between items-center rounded-xl">
                                            <div className="min-w-0 flex-1 mr-3">
                                                <p className="text-xs font-bold text-slate-800 truncate">{item.nome}</p>
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    Mínimo: <strong className="text-slate-600">{item.estoque_minimo} un</strong> • Custo: R$ {Number(item.valor_unitario || 0).toFixed(2)}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black ${
                                                    Number(item.quantidade) <= 0 
                                                        ? 'bg-red-100 text-red-700 border border-red-200' 
                                                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                }`}>
                                                    {item.quantidade} un
                                                </span>
                                                <p className="text-[8px] font-black uppercase tracking-wider text-red-500 mt-1">
                                                    {Number(item.quantidade) <= 0 ? 'Zerado' : 'Comprar'}
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {asArray(stats?.itensAbaixoMinimo).length === 0 && (
                                        <div className="text-center py-10 text-slate-400">
                                            <span className="text-2xl block mb-1">📦✅</span>
                                            <p className="text-xs font-bold uppercase">Almoxarifado em Conformidade</p>
                                            <p className="text-[10px]">Nenhum item abaixo do estoque mínimo de segurança.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                                <Link to="/estoque" className="text-[10px] font-black text-amber-700 hover:text-amber-900 uppercase">
                                    Gerenciar Entradas e Saídas do Almoxarifado ↗
                                </Link>
                            </div>
                        </div>
                    </div>

                </div>
            )}

            {/* ========================================================= */}
            {/* 💼 VISÃO 4: DIRETORIA & CUSTOS (EXECUTIVA)                */}
            {/* ========================================================= */}
            {visaoAtual === 'financeira' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* 🛒 NOVO PAINEL EXECUTIVO DE SUPRIMENTOS & SAVING */}
                    <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-6 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-800/60 px-2.5 py-0.5 rounded-full inline-block">
                                📊 Suprimentos & Negociação
                            </span>
                            <h4 className="text-base font-black uppercase tracking-tight">Indicador de Saving de Compras (Real vs. Orçado)</h4>
                            <p className="text-xs text-slate-300 font-medium max-w-xl">
                                Comparativo contábil entre o valor estimado nas requisições da engenharia e o valor faturado nas notas fiscais de baixa.
                            </p>
                        </div>
                        <div className="flex gap-4 sm:gap-6 text-center shrink-0 w-full md:w-auto justify-between md:justify-end">
                            <div className="bg-white/10 px-4 py-3 rounded-2xl backdrop-blur-xs">
                                <span className="text-xs text-slate-300 font-bold block">Valor Estimado</span>
                                <span className="text-lg font-black text-white font-mono">{formatarMoeda(estimadoTotalCompras)}</span>
                            </div>
                            <div className="bg-white/10 px-4 py-3 rounded-2xl backdrop-blur-xs">
                                <span className="text-xs text-slate-300 font-bold block">Valor Real Pago</span>
                                <span className="text-lg font-black text-emerald-400 font-mono">{formatarMoeda(realTotalCompras)}</span>
                            </div>
                            <div className="bg-emerald-500/20 border border-emerald-500/40 px-4 py-3 rounded-2xl backdrop-blur-xs">
                                <span className="text-xs text-emerald-300 font-bold block">Saving / Economia</span>
                                <span className={`text-lg font-black font-mono ${diferencaSaving >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {diferencaSaving >= 0 ? `+${formatarMoeda(diferencaSaving)}` : formatarMoeda(diferencaSaving)} ({percentualSaving}%)
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FinanceCard 
                            title="Insumos / Peças Aplicadas" 
                            value={formatarMoeda(gastoInsumos)} 
                            subtitle="Peças debitadas do almoxarifado em OS" 
                            color="border-indigo-500" 
                            bgGradient="from-indigo-50/40" 
                        />
                        <FinanceCard 
                            title="Parque de Equipamentos" 
                            value={formatarMoeda(gastoEquipamentos)} 
                            subtitle="Intervenções em máquinas médicas" 
                            color="border-emerald-500" 
                            bgGradient="from-emerald-50/40" 
                        />
                        <FinanceCard 
                            title="Infraestrutura & Predial" 
                            value={formatarMoeda(gastoEstrutura)} 
                            subtitle="Manutenções em leitos e instalações" 
                            color="border-purple-500" 
                            bgGradient="from-purple-50/40" 
                        />
                        <FinanceCard 
                            title="Custo Operacional Total" 
                            value={formatarMoeda(custoOperacionalTotal)} 
                            subtitle="Soma de insumos e mão de obra no período" 
                            color="border-slate-900" 
                            bgGradient="from-slate-100" 
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <div className="xl:col-span-7 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between min-h-[440px]">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3">
                                <div>
                                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🏥</span> Centros de Custo por Setor Hospitalar
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Rateio financeiro de reparos e peças aplicadas por unidade</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Top 6 Setores</span>
                            </div>
                            <div className="h-72 w-full">
                                <Bar data={dataCustoSetor} options={optionsTecnicos} />
                            </div>
                        </div>

                        <div className="xl:col-span-5 bg-white rounded-3xl shadow-sm border-2 border-emerald-100 overflow-hidden flex flex-col justify-between">
                            <div>
                                <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-[11px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span>💼</span> Prestadores Terceirizados Homologados
                                        </h3>
                                        <p className="text-[9px] font-bold text-emerald-700 uppercase mt-0.5">Gastos com assistências e laudos externos</p>
                                    </div>
                                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-md">
                                        {asArray(stats?.gastosPorFornecedor).length} Empresas
                                    </span>
                                </div>

                                <div className="divide-y divide-slate-100 p-2 max-h-[380px] overflow-y-auto">
                                    {asArray(stats?.gastosPorFornecedor).map((f, idx) => (
                                        <div key={idx} className="p-3 hover:bg-emerald-50/30 transition-colors flex justify-between items-center rounded-xl">
                                            <div className="min-w-0 flex-1 mr-3">
                                                <p className="text-xs font-bold text-slate-800 truncate">{f.fornecedor}</p>
                                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                    Volume: <strong className="text-slate-600">{f.total_os} OS atendidas</strong>
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-mono font-black text-emerald-700">
                                                    {formatarMoeda(f.total_valor)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}

                                    {asArray(stats?.gastosPorFornecedor).length === 0 && (
                                        <div className="text-center py-10 text-slate-400">
                                            <span className="text-2xl block mb-1">🤝✅</span>
                                            <p className="text-xs font-bold uppercase">Sem Contratos Externos no Período</p>
                                            <p className="text-[10px]">Manutenções 100% absorvidas pela equipe interna.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                                <Link to="/fornecedores" className="text-[10px] font-black text-emerald-700 hover:text-emerald-900 uppercase">
                                    Ver Cadastro de Fornecedores & Contratos ↗
                                </Link>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span>📅</span> Fluxo de Compromissos & Contas a Pagar
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                                <span className="text-xl font-black text-rose-700">
                                    {stats?.boletosAtrasados || 0}
                                </span>
                                <p className="text-[10px] font-bold text-rose-600 uppercase mt-1">Boletos em Atraso</p>
                            </div>

                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                <span className="text-xl font-black text-amber-700">
                                    {stats?.boletosVencendoHoje || 0}
                                </span>
                                <p className="text-[10px] font-bold text-amber-600 uppercase mt-1">Vencendo Hoje</p>
                            </div>

                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                                <span className="text-xl font-black text-blue-700">
                                    {stats?.boletosVencendoSemana || 0}
                                </span>
                                <p className="text-[10px] font-bold text-blue-600 uppercase mt-1">Vencimento em 7 Dias</p>
                            </div>
                        </div>
                    </div>

                </div>
            )}

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