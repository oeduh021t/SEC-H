import { useEffect, useState } from 'react';

const InventarioGeral = () => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [loading, setLoading] = useState(true);

    const API_URL = 'http://192.168.5.101:3000/api';

    useEffect(() => {
        fetch(`${API_URL}/relatorios/inventario-geral`)
            .then(res => res.json())
            .then(data => {
                setEquipamentos(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Erro ao carregar inventário:", err);
                setLoading(false);
            });
    }, []);

    // CORREÇÃO DO CÁLCULO: Garante que os valores sejam numéricos antes de somar
    const investimentoTotal = equipamentos.reduce((acc, curr) => {
        const valor = parseFloat(curr.total_gasto) || 0;
        return acc + valor;
    }, 0);

    if (loading) return (
        <div className="p-10 text-center animate-pulse text-slate-500 font-black tracking-widest uppercase">
            ⌛ Carregando Inventário...
        </div>
    );

    return (
        <div className="p-4 md:p-8 bg-white min-h-screen text-slate-800" id="area-impressao">
            
            {/* HEADER RELATÓRIO */}
            <header className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-1">
                        Inventário Patrimonial Geral
                    </h1>
                    <p className="text-blue-600 font-bold uppercase text-sm tracking-widest">
                        Hospital Domingos Lourenço
                    </p>
                    <p className="text-slate-400 text-[10px] font-bold mt-2 uppercase tracking-tighter">
                        Emissão: {new Date().toLocaleString('pt-BR')}
                    </p>
                </div>

                <div className="text-right flex flex-col items-end gap-3">
                    <button 
                        onClick={() => window.print()} 
                        className="d-print-none bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-xs hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                    >
                        🖨️ IMPRIMIR RELATÓRIO
                    </button>
                    
                    {/* CARD DE INVESTIMENTO CORRIGIDO */}
                    <div className="bg-red-600 text-white p-4 rounded-2xl shadow-xl min-w-[280px]">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-2 opacity-90">
                            Investimento Total Acumulado
                        </p>
                        <p className="text-2xl font-black tabular-nums">
                            R$ {investimentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </header>

            {/* TABELA DE ATIVOS */}
            <main className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100 border-b-2 border-slate-900">
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Patrimônio</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Equipamento / Marca</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider">Localização</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider text-right">Custo Acumulado</th>
                            <th className="p-3 text-[10px] font-black uppercase tracking-wider text-center d-print-none">Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {equipamentos.length > 0 ? (
                            equipamentos.map(e => (
                                <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-black text-blue-600 tracking-tighter">{e.patrimonio || '---'}</td>
                                    <td className="p-3">
                                        <div className="font-bold uppercase text-slate-900 leading-tight">{e.nome}</div>
                                        <div className="text-slate-400 text-[10px] font-medium italic">{e.marca || 'S/M'} / {e.modelo || 'S/M'}</div>
                                    </td>
                                    <td className="p-3 font-semibold text-slate-600">{e.setor_nome || 'Não definido'}</td>
                                    <td className="p-3 text-right font-black text-red-600 tabular-nums">
                                        R$ {(parseFloat(e.total_gasto) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-3 text-center d-print-none">
                                        <span className={`px-2 py-1 rounded-md font-black text-[9px] uppercase tracking-tighter ${
                                            e.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 border border-red-200'
                                        }`}>
                                            {e.status}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className="p-10 text-center font-bold text-slate-400 uppercase italic">
                                    Nenhum registro encontrado para este relatório.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </main>

            {/* ASSINATURAS PARA AUDITORIA (APARECE APENAS NA IMPRESSÃO) */}
            <footer className="hidden d-print-block mt-32">
                <div className="flex justify-between px-16 text-center text-[10px] font-black uppercase">
                    <div className="flex flex-col gap-1">
                        <div className="border-t-2 border-slate-900 pt-2 w-64">Responsável Engenharia</div>
                        <span className="text-slate-400 text-[8px]">Hospital Domingos Lourenço</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="border-t-2 border-slate-900 pt-2 w-64">Direção Administrativa</div>
                        <span className="text-slate-400 text-[8px]">Hospital Domingos Lourenço</span>
                    </div>
                </div>
            </footer>

            {/* ESTILOS DE IMPRESSÃO */}
            <style>{`
                @media print {
                    .d-print-none { display: none !important; }
                    .d-print-block { display: block !important; }
                    body { background: white !important; margin: 0; padding: 0; }
                    #area-impressao { padding: 0 !important; width: 100% !important; }
                    @page { margin: 1.5cm; size: auto; }
                    tr { page-break-inside: avoid; }
                }
            `}</style>
        </div>
    );
};

export default InventarioGeral;
