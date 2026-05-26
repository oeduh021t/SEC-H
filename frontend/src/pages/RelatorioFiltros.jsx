import { useEffect, useState, useCallback } from 'react';

const RelatorioFiltros = () => {
    // Define o período inicial padrão (últimos 30 dias)
    const hoje = new Date().toISOString().split('T')[0];
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [dataInicio, setDataInicio] = useState(trintaDiasAtras);
    const [dataFim, setDataFim] = useState(hoje);
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_URL = 'http://192.168.5.101:3000/api';

    const buscarRelatorio = useCallback(async () => {
        setLoading(true);
        try {
            // Recarrega o nível do usuário do localStorage dinamicamente para sanar o erro 401 Unauthorized
            const userLogado = localStorage.getItem('user');
            const nivelUsuario = userLogado ? JSON.parse(userLogado).nivel : '';

            const res = await fetch(`${API_URL}/filtros/relatorio?data_inicio=${dataInicio}&data_fim=${dataFim}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // 🔥 CORREÇÃO: Envia a credencial necessária para a API autorizar e listar os dados
                    'x-usuario-nivel': nivelUsuario
                }
            });

            if (!res.ok) throw new Error(`Erro na API: Código ${res.status}`);
            
            const json = await res.json();
            setDados(json);
        } catch (err) {
            console.error("Erro ao buscar relatório de filtros:", err);
        } finally {
            setLoading(false);
        }
    }, [dataInicio, dataFim, API_URL]);

    useEffect(() => {
        buscarRelatorio();
    }, [buscarRelatorio]);

    // Função auxiliar para limpar e destacar a observação técnica retirando o log de custo na exibição da tabela
    const formatarObs = (obs) => {
        if (!obs) return '';
        if (obs.includes('[')) {
            return obs.split('[')[0].trim();
        }
        return obs;
    };

    // Extrai o nome da peça usada de dentro do log salvo no banco
    const extrairPecaUsada = (obs) => {
        if (!obs || !obs.includes('Peça Deduzida:')) return 'Nenhum insumo baixado';
        try {
            const trecho = obs.split('Peça Deduzida:')[1];
            return trecho.split('|')[0].replace(']', '').trim();
        } catch {
            return 'Insumo não identificado';
        }
    };

    const formatarDataBR = (dataStr) => {
        if (!dataStr) return "";
        const [ano, mes, dia] = dataStr.split("-");
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* LÓGICA DE IMPRESSÃO ABSOLUTA: Oculta o sistema e força a exibição apenas do bloco de relatório */}
            <style>{`
                @media print {
                    body * { visibility: hidden; background: white !important; }
                    .relatorio-container, .relatorio-container * { visibility: visible; }
                    .relatorio-container { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        padding: 0;
                        margin: 0;
                    }
                    .hide-print { display: none !important; }
                    
                    /* Mantém os cards em row na folha A4 */
                    .indicadores-impressao {
                        display: flex !important;
                        flex-direction: row !important;
                        gap: 10px !important;
                        width: 100% !important;
                        margin-bottom: 20px !important;
                    }
                    .indicadores-impressao > div {
                        flex: 1 !important;
                        border: 1px solid #e2e8f0 !important;
                        padding: 12px !important;
                        border-radius: 12px !important;
                    }
                }
            `}</style>

            {/* BOTÃO SUPERIOR PADRONIZADO (Some na impressão) */}
            <div className="flex gap-2 justify-end mb-6 hide-print">
                <button 
                    onClick={() => window.print()} 
                    className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
                >
                    🖨️ IMPRIMIR RELATÓRIO
                </button>
            </div>

            {/* BARRA DE FILTROS DE DATA (Some na impressão) */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 hide-print">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Inicial</label>
                    <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Data Final</label>
                    <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                </div>
            </div>

            {/* CONTAINER ALVO DA IMPRESSÃO */}
            <div className="relatorio-container space-y-6">
                
                {/* CABEÇALHO DO RELATÓRIO */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-none print:p-0 print:mb-4">
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2 print:text-lg">
                        SEC-H - RELATÓRIO DE CUSTOS E TROCAS DE FILTROS
                    </h1>
                    <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider print:text-[10px] print:text-slate-500">
                        Período Mapeado: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)}
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-8 font-bold text-xs text-slate-400">Processando métricas...</div>
                ) : (
                    <>
                        {/* CARDS INDICADORES */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 indicadores-impressao">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Filtros Trocados no Período</span>
                                <p className="text-xl font-black text-slate-800 mt-1 print:text-sm">{dados?.indicators?.total_trocas || 0} Unidades</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-[8px]">Investimento / Custo Total</span>
                                <p className="text-xl font-black text-emerald-600 mt-1 print:text-sm">
                                    BRL {dados?.indicators?.custo_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* TABELA DE RESULTADOS */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 print:p-0 print:border-none">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider print:text-[9px] print:text-slate-700">
                                            <th className="pb-3">Data</th>
                                            <th className="pb-3">Ponto / Local</th>
                                            <th className="pb-3">Insumo Utilizado (Almoxarifado)</th>
                                            <th className="pb-3">Responsável</th>
                                            <th className="pb-3">Laudo Técnico</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 print:divide-slate-200">
                                        {dados?.detalhes?.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="text-center py-10 text-xs font-bold text-slate-400 italic">Nenhum registro encontrado para este intervalo.</td>
                                            </tr>
                                        ) : (
                                            dados?.detalhes?.map((row) => (
                                                <tr key={row.id} className="text-xs hover:bg-slate-50/50 transition-colors print:text-[10px]">
                                                    <td className="py-3.5 font-mono font-bold text-slate-500 print:text-slate-800">
                                                        {new Date(row.data_troca).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="py-3.5">
                                                        <div className="font-black text-slate-700 uppercase">{row.filtro_name || row.filtro_nome}</div>
                                                        <div className="text-[10px] text-blue-500 font-bold tracking-tight mt-0.5 uppercase print:text-slate-500">
                                                            {row.setor_nome || 'Setor Não Informado'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 font-medium text-slate-600">
                                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold print:border-none print:p-0 print:text-slate-900 ${
                                                            row.obs_intervencao?.includes('Peça Deduzida:') ? 'bg-slate-100 text-slate-700 border' : 'bg-amber-50 text-amber-600'
                                                        }`}>
                                                            {extrairPecaUsada(row.obs_intervencao)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 font-bold text-slate-600 uppercase tracking-tight print:text-slate-900">{row.tecnico_nome}</td>
                                                    <td className="py-3.5 text-slate-500 max-w-xs truncate font-medium print:max-w-none print:whitespace-pre-wrap" title={row.obs_intervencao}>
                                                        {formatarObs(row.obs_intervencao)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* RODAPÉ EXCLUSIVO DA IMPRESSÃO */}
                <div className="hidden print:block mt-12 pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                    Relatório gerencial emitido pelo sistema SEC-H Engenharia Clínica em {new Date().toLocaleString('pt-BR')}
                </div>

            </div>
        </div>
    );
};

export default RelatorioFiltros;