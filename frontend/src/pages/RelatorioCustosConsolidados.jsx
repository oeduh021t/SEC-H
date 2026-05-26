import { useEffect, useState, useCallback } from 'react';

const RelatorioCustosConsolidados = () => {
    const hoje = new Date().toISOString().split('T')[0];
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [setores, setSetores] = useState([]);
    const [setorSelecionado, setSetorSelecionado] = useState('');
    const [dataInicio, setDataInicio] = useState(trintaDiasAtras);
    const [dataFim, setDataFim] = useState(hoje);
    const [incluirEquipamentos, setIncluirEquipamentos] = useState(true);
    
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);

    const API_URL = 'http://192.168.5.101:3000/api';

    // Carrega a listagem de setores no carregamento inicial
    useEffect(() => {
        const userLogado = localStorage.getItem('user');
        const nivelUsuario = userLogado ? JSON.parse(userLogado).nivel : '';

        fetch(`${API_URL}/setores`, {
            headers: { 'x-usuario-nivel': nivelUsuario }
        })
            .then(res => res.json())
            .then(data => {
                setSetores(data || []);
                if (data && data.length > 0) setSetorSelecionado(data[0].id);
            })
            .catch(err => console.error("Erro ao carregar setores:", err));
    }, []);

    const buscarRelatorioConsolidado = useCallback(async () => {
        if (!setorSelecionado) return;
        setLoading(true);
        try {
            const userLogado = localStorage.getItem('user');
            const nivelUsuario = userLogado ? JSON.parse(userLogado).nivel : '';

            const res = await fetch(
                `${API_URL}/relatorios/custos-consolidados-setor?id=${setorSelecionado}&data_inicio=${dataInicio}&data_fim=${dataFim}&incluir_equipamentos=${incluirEquipamentos}`,
                {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-usuario-nivel': nivelUsuario
                    }
                }
            );

            if (!res.ok) throw new Error("Erro ao buscar relatório.");
            const json = await res.json();
            setDados(json);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [setorSelecionado, dataInicio, dataFim, incluirEquipamentos]);

    const formatarMoeda = (valor) => {
        return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen text-slate-800">
            <style>{`
                @media print {
                    body * { visibility: hidden; background: white !important; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .hide-print { display: none !important; }
                }
            `}</style>

            {/* BARRA DE FILTROS SUPERIOR */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 mb-6 hide-print">
                <div className="flex justify-between items-center border-b pb-3">
                    <h1 className="text-sm font-black text-slate-700 uppercase tracking-widest">📊 Custos Consolidados por Setor</h1>
                    <div className="flex gap-2">
                        <button onClick={buscarRelatorioConsolidado} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
                            🔍 Gerar Relatório
                        </button>
                        <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all">
                            🖨️ Imprimir PDF
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Setor Centro de Custo</label>
                        <select className="w-full p-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none focus:border-blue-500" value={setorSelecionado} onChange={e => setSetorSelecionado(e.target.value)}>
                            <option value="">Selecione o setor alvo...</option>
                            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Inicial</label>
                        <input type="date" className="w-full p-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Final</label>
                        <input type="date" className="w-full p-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-xs outline-none" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    </div>
                    <div className="p-2.5 flex items-center">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                            <input type="checkbox" className="w-4 h-4 text-blue-600 border-slate-200 rounded" checked={incluirEquipamentos} onChange={e => setIncluirEquipamentos(e.target.checked)} />
                            Incluir Custos de Equipamentos
                        </label>
                    </div>
                </div>
            </div>

            {/* CORPO DO RELATÓRIO ALVO DA IMPRESSÃO */}
            <div className="print-area space-y-6">
                {dados && (
                    <>
                        {/* HEADER DA FOLHA */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 print:border-none print:p-0">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">SEC-H — Relatório Consolidado de Custos Gerenciais</h2>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Filtro Alvo: <span className="text-blue-600">{dados.setor_nome}</span></p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Período: {new Date(dados.periodo.inicio).toLocaleDateString('pt-BR')} até {new Date(dados.periodo.fim).toLocaleDateString('pt-BR')}</p>
                        </div>

                        {/* BLOCO FINANCEIRO */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Custos Prediais / Infra</span>
                                <p className="text-lg font-black text-slate-800 mt-0.5">{formatarMoeda(dados.totais.infra)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Custos Biomédicos / Ativos</span>
                                <p className="text-lg font-black text-slate-800 mt-0.5">{formatarMoeda(dados.totais.equipamentos)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20">
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Investimento Total Alocado</span>
                                <p className="text-xl font-black text-emerald-600 mt-0.5">{formatarMoeda(dados.totais.geral)}</p>
                            </div>
                        </div>

                        {/* TABELA 1: INFRAESTRUTURA */}
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 print:p-0 print:border-none">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-1">1. Manutenções de Infraestrutura (Chamados Prediais)</h3>
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="pb-2">Data</th>
                                        <th className="pb-2">Setor Alvo</th>
                                        <th className="pb-2">Serviço / OS</th>
                                        <th className="pb-2 text-right">Mão de Obra</th>
                                        <th className="pb-2 text-right">Materiais</th>
                                        <th className="pb-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {dados.chamados_infra.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/40">
                                            <td className="py-2.5 font-bold text-slate-400">{new Date(c.data_abertura).toLocaleDateString('pt-BR')}</td>
                                            <td className="py-2.5 font-bold text-blue-600 uppercase">{c.nome_setor_specifico}</td>
                                            <td className="py-2.5 font-black text-slate-700 uppercase">#{c.id} - {c.titulo}</td>
                                            <td className="py-2.5 text-right font-mono">{formatarMoeda(c.custo_servico)}</td>
                                            <td className="py-2.5 text-right font-mono">{formatarMoeda(c.custo_materiais)}</td>
                                            <td className="py-2.5 text-right font-mono font-black text-slate-800">{formatarMoeda(Number(c.custo_servico) + Number(c.custo_materiais))}</td>
                                        </tr>
                                    ))}
                                    {dados.chamados_infra.length === 0 && (
                                        <tr><td colSpan="6" className="text-center py-4 font-bold text-slate-400 italic">Nenhum chamado de infraestrutura lançado no período.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* TABELA 2: EQUIPAMENTOS */}
                        {incluirEquipamentos && (
                            <div className="bg-white p-6 rounded-3xl border border-slate-100 print:p-0 print:border-none">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b pb-1">2. Gastos Detalhadados por Ativos / Equipamentos</h3>
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="border-b-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                            <th className="pb-2">Data</th>
                                            <th className="pb-2">Equipamento (Patrimônio)</th>
                                            <th className="pb-2">Laudo Técnico</th>
                                            <th className="pb-2 text-right">M. Obra</th>
                                            <th className="pb-2 text-right">Materiais</th>
                                            <th className="pb-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {dados.chamados_equipamentos.map(m => (
                                            <tr key={m.id} className="hover:bg-slate-50/40">
                                                <td className="py-2.5 font-bold text-slate-400">{new Date(m.data_conclusao).toLocaleDateString('pt-BR')}</td>
                                                <td className="py-2.5 font-black text-slate-700 uppercase">{m.nome_equipmento || m.nome_equipamento} ({m.patrimonio || 'S/P'})</td>
                                                <td className="py-2.5 font-medium text-slate-500">{m.titulo}</td>
                                                <td className="py-2.5 text-right font-mono">{formatarMoeda(m.custo_servico)}</td>
                                                <td className="py-2.5 text-right font-mono">{formatarMoeda(m.custo_materiais)}</td>
                                                <td className="py-2.5 text-right font-mono font-black text-slate-800">{formatarMoeda(Number(m.custo_servico) + Number(m.custo_materiais))}</td>
                                            </tr>
                                        ))}
                                        {dados.chamados_equipamentos.length === 0 && (
                                            <tr><td colSpan="6" className="text-center py-4 font-bold text-slate-400 italic">Nenhum custo com ativos biomédicos registrado.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {loading && <div className="text-center py-10 font-bold text-slate-400 text-xs animate-pulse tracking-widest uppercase">Consolidando e processando balanço de contas...</div>}
            </div>
        </div>
    );
};

export default RelatorioCustosConsolidados;