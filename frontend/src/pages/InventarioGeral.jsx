import { useEffect, useState } from 'react';

const InventarioGeral = () => {
    const [equipamentos, setEquipamentos] = useState([]);
    const [setores, setSetores] = useState([]);
    const [tiposEquipamentos, setTiposEquipamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [exportando, setExportando] = useState(false);

    // Estados dos filtros dinâmicos
    const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
    const [setorSelecionado, setSetorSelecionado] = useState("todos");
    const [statusSelecionado, setStatusSelecionado] = useState("todos");
    const [tipoSelecionado, setTipoSelecionado] = useState("todos");

    const API_URL = 'http://192.168.5.101:3000/api';

    // AUXILIAR: Captura dinamicamente o privilégio operacional do operador logado
    const obterNivelUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser).nivel : '';
    };

    // Busca a lista de setores cadastrados
    const carregarSetores = async () => {
        try {
            const res = await fetch(`${API_URL}/setores`, {
                headers: { "x-usuario-nivel": obterNivelUsuario() }
            }).then(res => res.json());
            setSetores(res || []);
        } catch (err) {
            console.error("Erro ao carregar setores no inventário:", err);
        }
    };

    // Busca a lista de tipos de equipamentos cadastrados
    const carregarTiposEquipamentos = async () => {
        try {
            const res = await fetch(`${API_URL}/tipos-equipamentos`, {
                headers: { "x-usuario-nivel": obterNivelUsuario() }
            }).then(res => res.json());
            setTiposEquipamentos(res || []);
        } catch (err) {
            console.error("Erro ao carregar tipos de equipamentos:", err);
        }
    };

    // Puxa os dados refinados do inventário aplicando as query strings de filtro
    const carregarInventarioFiltrado = async () => {
        setLoading(true);
        try {
            const url = `${API_URL}/relatorios/inventario-geral?data_inicio=${dataInicio}&data_fim=${dataFim}&setor_id=${setorSelecionado}&status=${statusSelecionado}&tipo_id=${tipoSelecionado}`;
            
            const res = await fetch(url, {
                headers: { "x-usuario-nivel": obterNivelUsuario() }
            }).then(res => res.json());
            setEquipamentos(res || []);
        } catch (err) {
            console.error("Erro ao carregar inventário patrimonial:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        carregarSetores(); 
        carregarTiposEquipamentos();
    }, []);
    
    useEffect(() => { 
        carregarInventarioFiltrado(); 
    }, [dataInicio, dataFim, setorSelecionado, statusSelecionado, tipoSelecionado]);

    // 📊 EXPORTAÇÃO DIRETA PARA EXCEL (.XLSX)
    const handleExportarExcel = async () => {
        setExportando(true);
        try {
            const url = `${API_URL}/relatorios/exportar/inventario-geral?data_inicio=${dataInicio}&data_fim=${dataFim}&setor_id=${setorSelecionado}&status=${statusSelecionado}&tipo_id=${tipoSelecionado}`;
            
            const res = await fetch(url, {
                headers: { "x-usuario-nivel": obterNivelUsuario() }
            });

            if (!res.ok) throw new Error("Falha ao gerar o arquivo Excel.");

            const blob = await res.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `inventario_patrimonial_${dataInicio}_a_${dataFim}.xlsx`;
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

    const investimentoTotal = equipamentos.reduce((acc, curr) => {
        const valor = parseFloat(curr.total_gasto) || 0;
        return acc + valor;
    }, 0);

    const formatarDataBR = (dataStr) => {
        if (!dataStr) return "";
        const [ano, mes, dia] = dataStr.split("-");
        return `${dia}/${mes}/${ano}`;
    };

    if (loading) return (
        <div className="p-10 text-center animate-pulse text-slate-500 font-black tracking-widest uppercase text-xs">
            ⌛ Processando balanço patrimonial dos ativos...
        </div>
    );

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800 print:bg-white print:p-0">
            
            {/* AMARRAÇÃO DEFINITIVA DE IMPRESSÃO */}
            <style>{`
                @media print {
                    body * { visibility: hidden; background: white !important; }
                    #area-impressao, #area-impressao * { visibility: visible; }
                    #area-impressao { 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 100%; 
                        padding: 0 !important; 
                        margin: 0 !important; 
                    }
                    .hide-print { display: none !important; }
                    table { width: 100% !important; border-collapse: collapse !important; }
                    tr { page-break-inside: avoid !important; }
                }
            `}</style>

            {/* BARRA DE FERRAMENTAS E FILTROS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 mb-6 hide-print">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-50 pb-3 gap-3">
                    <div>
                        <h3 className="text-sm font-black uppercase text-slate-700 tracking-wider">Filtros de Auditoria</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Refine os custos aplicados por intervalo de tempo, localidade, tipo ou status</p>
                    </div>
                    
                    {/* BOTÕES DE EXPORTAÇÃO E IMPRESSÃO */}
                    <div className="flex gap-2">
                        <button 
                            onClick={handleExportarExcel} 
                            disabled={exportando || loading}
                            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98] flex items-center gap-2 disabled:opacity-50"
                        >
                            <span>📊</span> {exportando ? "Gerando..." : "Exportar Excel"}
                        </button>

                        <button 
                            onClick={() => window.print()} 
                            className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md active:scale-[0.98] flex items-center gap-2"
                        >
                            <span>🖨️</span> Gerar PDF / Imprimir
                        </button>
                    </div>
                </div>

                {/* Grid adaptado para 5 colunas em telas maiores */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Período Inicial</label>
                        <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Período Final</label>
                        <input type="date" className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-black" value={dataFim} onChange={e => setDataFim(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Centro de Custo / Setor</label>
                        <select className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700" value={setorSelecionado} onChange={e => setSetorSelecionado(e.target.value)}>
                            <option value="todos">⭐ Todos os Setores</option>
                            {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Tipo de Equipamento</label>
                        <select 
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700" 
                            value={tipoSelecionado} 
                            onChange={e => setTipoSelecionado(e.target.value)}
                        >
                            <option value="todos">⭐ Todos os Tipos</option>
                            {tiposEquipamentos.map(t => (
                                <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Status do Ativo</label>
                        <select 
                            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500 text-slate-700" 
                            value={statusSelecionado} 
                            onChange={e => setStatusSelecionado(e.target.value)}
                        >
                            <option value="todos">⭐ Todos os Status</option>
                            <option value="Ativo">🟢 Ativo</option>
                            <option value="Em Manutenção">🟡 Em Manutenção</option>
                            <option value="Reserva">🔵 Reserva</option>
                            <option value="Baixado/Quebrado">🔴 Baixado/Quebrado</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* ÁREA ALVO DA IMPRESSÃO EXCLUSIVA */}
            <div id="area-impressao" className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 print:p-0 print:border-none print:shadow-none">
                
                {/* HEADER RELATÓRIO */}
                <header className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8 print:mb-4">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1 text-slate-800">
                            Inventário Patrimonial Geral
                        </h1>
                        <p className="text-blue-600 font-bold uppercase text-xs tracking-widest">
                            Hospital Domingos Lourenço
                        </p>
                        <p className="text-slate-400 text-[9px] font-bold mt-2 uppercase tracking-tighter">
                            Escopo: {formatarDataBR(dataInicio)} até {formatarDataBR(dataFim)} 
                            {statusSelecionado !== 'todos' && ` | Status: ${statusSelecionado}`}
                        </p>
                    </div>

                    <div className="text-right">
                        <div className="bg-red-600 text-white p-4 rounded-2xl shadow-xl min-w-[260px] print:p-2 print:border print:text-slate-900 print:bg-none print:shadow-none">
                            <p className="text-[9px] font-black uppercase tracking-widest leading-none mb-1.5 opacity-90 print:text-slate-400">
                                Investimento no Período
                            </p>
                            <p className="text-xl font-black tabular-nums print:text-red-600">
                                R$ {investimentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                        </div>
                    </div>
                </header>

                {/* TABELA DE ATIVOS */}
                <main className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 border-b-2 border-slate-900 print:bg-slate-50">
                                <th className="p-3 text-[10px] font-black uppercase tracking-wider">Patrimônio</th>
                                <th className="p-3 text-[10px] font-black uppercase tracking-wider">Equipamento / Marca</th>
                                <th className="p-3 text-[10px] font-black uppercase tracking-wider">Localização</th>
                                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-right">Custo Acumulado</th>
                                <th className="p-3 text-[10px] font-black uppercase tracking-wider text-center hide-print">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-100">
                            {equipamentos.length > 0 ? (
                                equipamentos.map(e => (
                                    <tr key={e.id} className="hover:bg-slate-50 transition-colors print:text-[10px]">
                                        <td className="p-3 font-black text-blue-600 tracking-tighter print:text-slate-800">{e.patrimonio || '---'}</td>
                                        <td className="p-3">
                                            <div className="font-bold uppercase text-slate-900 leading-tight">{e.nome}</div>
                                            <div className="text-slate-400 text-[10px] font-medium italic">{e.marca || 'S/M'} / {e.modelo || 'S/M'}</div>
                                        </td>
                                        <td className="p-3 font-semibold text-slate-600">{e.setor_nome || 'Não definido'}</td>
                                        <td className="p-3 text-right font-black text-red-600 tabular-nums bg-slate-50/20 rounded-lg">
                                            R$ {(parseFloat(e.total_gasto) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-center hide-print">
                                            <span className={`px-2 py-1 rounded-md font-black text-[9px] uppercase tracking-tighter border ${
                                                e.status === 'Ativo' 
                                                    ? 'bg-green-100 text-green-700 border-green-200' 
                                                    : e.status === 'Em Manutenção'
                                                    ? 'bg-amber-100 text-amber-700 border-amber-200 animate-pulse'
                                                    : e.status === 'Reserva'
                                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                    : 'bg-red-100 text-red-700 border-red-200'
                                            }`}>
                                                {e.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="p-10 text-center font-bold text-slate-400 uppercase italic">
                                        Nenhum registro de custo mapeado para os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </main>

                {/* ASSINATURAS PARA AUDITORIA */}
                <footer className="hidden print:block mt-24">
                    <div className="flex justify-between px-16 text-center text-[9px] font-black uppercase tracking-wider">
                        <div className="flex flex-col gap-1">
                            <div className="border-t border-slate-900 pt-2 w-56">Responsável Engenharia</div>
                            <span className="text-slate-400 text-[7px] lowercase font-normal">emitido em: {new Date().toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="border-t border-slate-900 pt-2 w-56">Direção Administrativa</div>
                            <span className="text-slate-400 text-[7px] lowercase font-normal">SEC-H Engenharia Clínica</span>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default InventarioGeral;