import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const Gases = () => {
    const [gases, setGases] = useState([]);
    const [historico, setHistorico] = useState([]);
    const [loading, setLoading] = useState(true);
    const [abaAtiva, setAbaAtiva] = useState('estoque'); // 'estoque' ou 'historico'
    
    // Estados dos Modals
    const [modalNovoGas, setModalNovoGas] = useState(false);
    const [modalCompra, setModalCompra] = useState(false);
    const [modalConsumo, setModalConsumo] = useState(false);

    // Formulários
    const [formNovoGas, setFormNovoGas] = useState({ tipo_gas: '', capacidade_cilindro: '', estoque_minimo: '' });
    const [formCompra, setFormCompra] = useState({ tipo_gas_id: '', quantidade_cilindros: '', valor_unitario_cilindro: '', observacao: '' });
    const [formConsumo, setFormConsumo] = useState({ tipo_gas_id: '', quantidade_cilindros: 1, observacao: '' });

    const API_URL = 'http://192.168.5.101:3000/api';
    
    const usuarioSalvo = localStorage.getItem('user');
    const user = usuarioSalvo ? JSON.parse(usuarioSalvo) : { nome: 'Técnico', nivel: '' };
    const nivel = user.nivel;

    const carregarDados = async () => {
        setLoading(true);
        try {
            const resGases = await fetch(`${API_URL}/gases`, {
                headers: { 'x-usuario-nivel': nivel }
            });
            const dataGases = await resGases.json();
            setGases(dataGases);

            const resHist = await fetch(`${API_URL}/gases/historico`, {
                headers: { 'x-usuario-nivel': nivel }
            });
            const dataHist = await resHist.json();
            setHistorico(dataHist);
        } catch (err) {
            console.error("Erro ao carregar dados de gases:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    // Handlers para envio de dados
    const handleCadastrarGas = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/gases`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify(formNovoGas)
            });
            if (res.ok) {
                alert("Novo gás cadastrado!");
                setModalNovoGas(false);
                setFormNovoGas({ tipo_gas: '', capacidade_cilindro: '', estoque_minimo: '' });
                carregarDados();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (err) {
            alert("Erro ao conectar com o servidor.");
        }
    };

    const handleRegistrarCompra = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/gases/entrada`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify({ ...formCompra, tecnico_nome: user.nome })
            });
            if (res.ok) {
                alert("Compra registrada com sucesso!");
                setModalCompra(false);
                setFormCompra({ tipo_gas_id: '', quantidade_cilindros: '', valor_unitario_cilindro: '', observacao: '' });
                carregarDados();
            }
        } catch (err) {
            alert("Erro ao processar compra.");
        }
    };

    const handleRegistrarConsumo = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/gases/consumo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-usuario-nivel': nivel },
                body: JSON.stringify({ ...formConsumo, tecnico_nome: user.nome })
            });
            if (res.ok) {
                alert("Baixa de cilindro registrada!");
                setModalConsumo(false);
                setFormConsumo({ tipo_gas_id: '', quantidade_cilindros: 1, observacao: '' });
                carregarDados();
            } else {
                const err = await res.json();
                alert(err.error);
            }
        } catch (err) {
            alert("Erro ao registrar consumo.");
        }
    };

    // Cálculos Rápidos para Indicadores
    const totalCilindros = gases.reduce((acc, curr) => acc + curr.quantidade_atual, 0);
    const gasesEmAlerta = gases.filter(g => g.alerta_estoque === 1).length;
    const totalGastoMes = historico
        .filter(h => h.tipo_movimentacao === 'Entrada')
        .reduce((acc, curr) => acc + Number(curr.custo_total_movimentacao), 0);

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans">
            {/* Header de Ações */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 bg-white p-4 rounded-2xl shadow-sm gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl bg-sky-100 p-2 rounded-xl">🧪</span>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Central de Gases Medicinais</h1>
                        <p className="text-xs font-semibold text-slate-400">Controle de Estoque e Fluxo de Consumo Hospitalar</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {['admin', 'coordenador'].includes(nivel) && (
                        <>
                            <button onClick={() => setModalNovoGas(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-transform active:scale-95 shadow-md shadow-emerald-100">+ CADASTRAR GÁS</button>
                            <button onClick={() => setModalCompra(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-blue-700 transition-transform active:scale-95 shadow-md shadow-blue-100">🛒 REGISTRAR COMPRA</button>
                        </>
                    )}
                    <button onClick={() => setModalConsumo(true)} className="bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-amber-600 transition-transform active:scale-95 shadow-md shadow-amber-100">🔄 REGISTRAR TROCA (CONSUMO)</button>
                    <Link to="/equipamentos" className="bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-slate-300 transition-colors">VOLTAR</Link>
                </div>
            </div>

            {/* Grid de Indicadores Superiores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Cilindros na Central</span>
                        <span className="text-3xl font-black text-slate-800">{totalCilindros} <span className="text-xs text-slate-400">un. cheias</span></span>
                    </div>
                    <span className="text-3xl bg-blue-50 p-3 rounded-2xl">📦</span>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Gases com Estoque Baixo</span>
                        <span className={`text-3xl font-black ${gasesEmAlerta > 0 ? 'text-red-500' : 'text-emerald-500'}`}>{gasesEmAlerta}</span>
                    </div>
                    <span className={`text-3xl p-3 rounded-2xl ${gasesEmAlerta > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>⚠️</span>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider block mb-1">Investimento Geral</span>
                        <span className="text-2xl font-black text-slate-800">R$ {totalGastoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <span className="text-3xl bg-emerald-50 p-3 rounded-2xl">💰</span>
                </div>
            </div>

            {/* Abas de Navegação Interna */}
            <div className="flex border-b border-slate-200 mb-6 gap-4">
                <button 
                    onClick={() => setAbaAtiva('estoque')}
                    className={`pb-3 font-bold text-xs uppercase tracking-widest transition-all ${abaAtiva === 'estoque' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-400'}`}
                >
                    📊 Estoque de Gases
                </button>
                <button 
                    onClick={() => setAbaAtiva('historico')}
                    className={`pb-3 font-bold text-xs uppercase tracking-widest transition-all ${abaAtiva === 'historico' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-slate-400'}`}
                >
                    🕒 Extrato de Movimentações
                </button>
            </div>

            {loading ? (
                <div className="p-10 text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse text-center">Carregando dados...</div>
            ) : (
                <>
                    {/* ABA DE ESTOQUE */}
                    {abaAtiva === 'estoque' && (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                                        <tr>
                                            <th className="p-4">Tipo de Gás</th>
                                            <th className="p-4 text-center">Tamanho Cilindro</th>
                                            <th className="p-4 text-center">Cilindros Cheios</th>
                                            <th className="p-4 text-center">Volume Total ($m^3$)</th>
                                            <th className="p-4">Preço do Último Lote</th>
                                            <th className="p-4">Status Alerta</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-medium text-slate-600">
                                        {gases.map((gas) => (
                                            <tr key={gas.id} className="border-b border-slate-50 hover:bg-slate-50/55 transition-colors">
                                                <td className="p-4 font-bold text-slate-800">{gas.tipo_gas}</td>
                                                <td className="p-4 text-center font-mono">{gas.capacidade_cilindro} $m^3$</td>
                                                <td className="p-4 text-center font-black text-slate-700">{gas.quantidade_atual} un.</td>
                                                <td className="p-4 text-center font-bold text-blue-600">{gas.volume_total_m3} $m^3$</td>
                                                <td className="p-4 font-mono font-bold">R$ {Number(gas.valor_ultimo_cilindro).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[9px] font-black uppercase text-white ${gas.alerta_estoque ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}>
                                                        {gas.alerta_estoque ? 'Estoque Crítico' : 'Estabilizado'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ABA DE HISTÓRICO */}
                    {abaAtiva === 'historico' && (
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase">
                                        <tr>
                                            <th className="p-4">Data</th>
                                            <th className="p-4">Gás</th>
                                            <th className="p-4">Operação</th>
                                            <th className="p-4 text-center">Qtd. Cilindros</th>
                                            <th className="p-4">Custo Total</th>
                                            <th className="p-4">Responsável</th>
                                            <th className="p-4">Nota / Observações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-xs font-medium text-slate-600">
                                        {historico.map((hist) => (
                                            <tr key={hist.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                <td className="p-4 text-slate-400 font-bold">{new Date(hist.data_movimentacao).toLocaleDateString('pt-BR')}</td>
                                                <td className="p-4 font-bold">{hist.tipo_gas}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase text-white ${hist.tipo_movimentacao === 'Entrada' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                                                        {hist.tipo_movimentacao === 'Entrada' ? 'Compra' : 'Troca / Saída'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center font-mono font-bold">{hist.quantidade_cilindros} un.</td>
                                                <td className="p-4 font-mono font-bold text-slate-700">
                                                    {hist.tipo_movimentacao === 'Entrada' ? `R$ ${Number(hist.custo_total_movimentacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---'}
                                                </td>
                                                <td className="p-4 italic">{hist.tecnico_responsavel}</td>
                                                <td className="p-4 text-slate-400 max-w-xs truncate">{hist.observacao}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* MODAL: NOVO GÁS */}
            {modalNovoGas && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="font-black text-slate-800 text-lg uppercase mb-4">🧪 Cadastrar Novo Tipo de Gás</h2>
                        <form onSubmit={handleCadastrarGas} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nome do Gás</label>
                                <input type="text" placeholder="Ex: Dióxido de Carbono" required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formNovoGas.tipo_gas} onChange={e => setFormNovoGas({...formNovoGas, tipo_gas: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Capacidade ($m^3$)</label>
                                    <input type="number" step="0.1" placeholder="Ex: 10" required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formNovoGas.capacidade_cilindro} onChange={e => setFormNovoGas({...formNovoGas, capacidade_cilindro: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Estoque Mínimo</label>
                                    <input type="number" placeholder="Ex: 5" required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formNovoGas.estoque_minimo} onChange={e => setFormNovoGas({...formNovoGas, estoque_minimo: e.target.value})} />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex-1">SALVAR</button>
                                <button type="button" onClick={() => setModalNovoGas(false)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs flex-1">CANCELAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REGISTRAR COMPRA */}
            {modalCompra && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="font-black text-slate-800 text-lg uppercase mb-4">🛒 Registrar Lote de Compra</h2>
                        <form onSubmit={handleRegistrarCompra} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Selecionar Gás</label>
                                <select required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formCompra.tipo_gas_id} onChange={e => setFormCompra({...formCompra, tipo_gas_id: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {gases.map(g => <option key={g.id} value={g.id}>{g.tipo_gas} ({g.capacidade_cilindro} $m^3$)</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Quantidade</label>
                                    <input type="number" required placeholder="Cilindros cheios" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formCompra.quantidade_cilindros} onChange={e => setFormCompra({...formCompra, quantidade_cilindros: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Preço Unitário (R$)</label>
                                    <input type="number" step="0.01" required placeholder="Valor por cilindro" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formCompra.valor_unitario_cilindro} onChange={e => setFormCompra({...formCompra, valor_unitario_cilindro: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observações</label>
                                <textarea placeholder="Ex: NF-1234. Fornecedor White Martins." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs h-20" value={formCompra.observacao} onChange={e => setFormCompra({...formCompra, observacao: e.target.value})} />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex-1">REGISTRAR ENTRADA</button>
                                <button type="button" onClick={() => setModalCompra(false)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs flex-1">FECHAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: REGISTRAR TROCA (CONSUMO) */}
            {modalConsumo && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center p-4 z-50">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="font-black text-slate-800 text-lg uppercase mb-4">🔄 Registrar Troca de Cilindro (Saída)</h2>
                        <form onSubmit={handleRegistrarConsumo} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Gás que foi Trocado</label>
                                <select required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formConsumo.tipo_gas_id} onChange={e => setFormConsumo({...formConsumo, tipo_gas_id: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {gases.map(g => <option key={g.id} value={g.id}>{g.tipo_gas} (Disponível: {g.quantidade_atual} un.)</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Quantidade de Cilindros Trocados</label>
                                <input type="number" required className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" value={formConsumo.quantidade_cilindros} onChange={e => setFormConsumo({...formConsumo, quantidade_cilindros: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Observações do Técnico</label>
                                <textarea placeholder="Ex: Realizada a virada do manifold do manifold B para o manifold A." className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs h-20" value={formConsumo.observacao} onChange={e => setFormConsumo({...formConsumo, observacao: e.target.value})} />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="submit" className="bg-amber-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex-1">REGISTRAR BAIXA</button>
                                <button type="button" onClick={() => setModalConsumo(false)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold text-xs flex-1">CANCELAR</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gases;