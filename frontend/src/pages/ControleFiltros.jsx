import { useEffect, useState } from 'react';

const ControleFiltros = () => {
    const [filtros, setFiltros] = useState([]);
    const [setores, setSetores] = useState([]);
    const [equipamentos, setEquipamentos] = useState([]);
    const [itensEstoque, setItensEstoque] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState('');

    // Estados do Formulário de Cadastro
    const [nome, setNome] = useState('');
    const [equipamentoId, setEquipamentoId] = useState('');
    const [setorId, setSetorId] = useState('');
    const [modeloRefil, setModeloRefil] = useState('');
    const [periodicidadeMeses, setPeriodicidadeMeses] = useState(3);
    const [dataUltimaTroca, setDataUltimaTroca] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    // Estados do Modal de Baixa/Troca
    const [modalBaixa, setModalBaixa] = useState(false);
    const [filtroSelecionado, setFiltroSelecionado] = useState(null);
    const [obsIntervencao, setObsIntervencao] = useState('');
    const [itemIdSelecionado, setItemIdSelecionado] = useState(''); 
    const [qtdUsada, setQtdUsada] = useState(1); 

    const API_URL = 'http://192.168.5.101:3000/api';

    const obterNivelUsuario = () => {
        const savedUser = localStorage.getItem('user');
        return savedUser ? JSON.parse(savedUser).nivel : '';
    };

    const formatarDataSemFuso = (dataString) => {
        if (!dataString) return '--/--/----';
        const [ano, mes, dia] = dataString.split('T')[0].split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const carregarDados = async () => {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'x-usuario-nivel': obterNivelUsuario()
            };

            const [resFiltros, resSetores, resEquipamentos, resEstoque] = await Promise.all([
                fetch(`${API_URL}/filtros`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/setores`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/equipamentos`, { headers }).then(res => res.json()),
                fetch(`${API_URL}/estoque`, { headers }).then(res => res.json()) 
            ]);

            // 🎯 FILTRO EXCLUSIVO: Isola apenas os equipamentos do tipo 19 (Bebedouros)
            const bebedourosApenas = (resEquipamentos || []).filter(eq => 
                Number(eq.tipo_id) === 19 || Number(eq.tipo_equipamento_id) === 19
            );

            setFiltros(resFiltros || []);
            setSetores(resSetores || []);
            setEquipamentos(bebedourosApenas);
            setItensEstoque(resEstoque || []);
        } catch (err) {
            console.error("Erro ao carregar dados do módulo de filtros:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { carregarDados(); }, []);

    // 💡 Ao selecionar um Bebedouro, auto-preenche o Setor e sugere o Nome do Ponto
    const handleSelecionarEquipamento = (id) => {
        setEquipamentoId(id);
        if (!id) return;

        const eq = equipamentos.find(e => Number(e.id) === Number(id));
        if (eq) {
            if (eq.setor_id) setSetorId(String(eq.setor_id));
            if (!nome) setNome(`${eq.nome} (${eq.patrimonio || 'S/P'})`);
        }
    };

    const handleCadastrarFiltro = async (e) => {
        e.preventDefault();
        if (!nome || !setorId) return;

        const novoFiltro = {
            nome,
            equipamento_id: equipamentoId || null,
            setor_id: setorId,
            modelo_refil: modeloRefil,
            data_ultima_troca: dataUltimaTroca,
            periodicidade_meses: Number(periodicidadeMeses),
            observacoes
        };

        try {
            const res = await fetch(`${API_URL}/filtros`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-usuario-nivel': obterNivelUsuario()
                },
                body: JSON.stringify(novoFiltro)
            });

            if (res.ok) {
                alert("Ponto de filtragem monitorado com sucesso! 🚰✅");
                setNome(''); setEquipamentoId(''); setSetorId(''); setModeloRefil('');
                setPeriodicidadeMeses(3); setObservacoes('');
                carregarDados();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRegistrarTroca = async (e) => {
        e.preventDefault();
        
        const userLogado = localStorage.getItem('user');
        const tecnicoNome = userLogado ? JSON.parse(userLogado).nome : 'Técnico do Sistema';

        try {
            const res = await fetch(`${API_URL}/filtros/baixa`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-usuario-nivel': obterNivelUsuario()
                },
                body: JSON.stringify({
                    filtro_id: filtroSelecionado.id,
                    tecnico_nome: tecnicoNome,
                    obs_intervencao: obsIntervencao,
                    item_id: itemIdSelecionado ? Number(itemIdSelecionado) : null, 
                    quantidade: Number(qtdUsada)
                })
            });

            if (res.ok) {
                alert("Troca efetuada, insumo baixado e custo processado no histórico! 🔄💰");
                setModalBaixa(false);
                setObsIntervencao('');
                setItemIdSelecionado('');
                setQtdUsada(1);
                setFiltroSelecionado(null);
                carregarDados();
            } else {
                const erroData = await res.json();
                alert(`❌ Erro: ${erroData.error || 'Estoque insuficiente ou erro no processamento.'}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filtrosFiltrados = filtros.filter(f => {
        const termo = busca.toLowerCase();
        return (
            (f.nome && f.nome.toLowerCase().includes(termo)) ||
            (f.modelo_refil && f.modelo_refil.toLowerCase().includes(termo)) ||
            (f.setor_nome && f.setor_nome.toLowerCase().includes(termo)) ||
            (f.equipamento_nome && f.equipamento_nome.toLowerCase().includes(termo)) ||
            (f.equipamento_patrimonio && f.equipamento_patrimonio.toLowerCase().includes(termo))
        );
    });

    const totais = filtros.reduce((acc, curr) => {
        if (curr.dias_restantes < 0) acc.vencidos++;
        else if (curr.dias_restantes <= 15) acc.atencao++;
        else acc.emDia++;
        return acc;
    }, { vencidos: 0, atencao: 0, emDia: 0 });

    const refisFiltrados = itensEstoque.filter(item => item.tipo?.toLowerCase() === 'filtro');

    if (loading) return <div className="p-10 text-center font-bold text-slate-400">Processando cronograma de saturação dos refis...</div>;

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
            
            {/* CABEÇALHO */}
            <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🚰</span> MONITORAMENTO E TROCA DE FILTROS
                  </h1>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Controle microbiológico e troca de elementos filtrantes com baixa de almoxarifado</p>
                </div>
                <input 
                  type="text" 
                  placeholder="🔍 Buscar ponto de água, bebedouro ou refil..." 
                  className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-72 focus:border-blue-500 transition-colors"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
            </div>

            {/* CARD INDICADORES */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Elementos Filtrantes em Dia</span>
                        <p className="text-xl font-black text-green-600 mt-0.5">{totais.emDia} Pontos</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atenção (Trocar em 15 dias)</span>
                        <p className="text-xl font-black text-amber-500 mt-0.5">{totais.atencao} Pontos</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Saturação Crítica / Vencidos</span>
                        <p className="text-xl font-black text-red-500 mt-0.5">{totais.vencidos} Refis</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* FORMULÁRIO DE CADASTRO */}
                <div className="lg:col-span-4">
                    <form onSubmit={handleCadastrarFiltro} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2">Novo Ponto de Filtragem</h3>
                        
                        {/* SELEÇÃO EXCLUSIVA DE BEBEDOUROS (TIPO ID = 19) */}
                        <div>
                            <label className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Vincular Bebedouro Cadastrado (Opcional)</label>
                            <select 
                                className="w-full p-3 border-2 border-blue-100 rounded-xl bg-blue-50/50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500 text-slate-700" 
                                value={equipamentoId} 
                                onChange={e => handleSelecionarEquipamento(e.target.value)}
                            >
                                <option value="">Sem bebedouro específico (Ponto de parede / Torneira)</option>
                                {equipamentos.map(eq => (
                                    <option key={eq.id} value={eq.id}>
                                        🚰 {eq.nome} {eq.patrimonio ? `(PAT: ${eq.patrimonio})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Identificação do Ponto</label>
                            <input required type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Ex: Bebedouro Recepção, Purificador UTI" value={nome} onChange={e => setNome(e.target.value)} />
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Localização / Setor</label>
                            <select required className="w-full p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-blue-500" value={setorId} onChange={e => setSetorId(e.target.value)}>
                                <option value="">Selecione o Setor...</option>
                                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Modelo do Elemento Filtrante (Refil)</label>
                            <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Ex: Carbon Block 9' 3/4, Plissado 5m" value={modeloRefil} onChange={e => setModeloRefil(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Trocar a cada (Meses)</label>
                                <input min="1" max="24" type="number" className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white" value={periodicidadeMeses} onChange={e => setPeriodicidadeMeses(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Última Troca</label>
                                <input required type="date" className="w-full p-3 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white text-xs" value={dataUltimaTroca} onChange={e => setDataUltimaTroca(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Observações de Instalação</label>
                            <textarea rows={2} className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 outline-none resize-none focus:bg-white focus:border-blue-500" placeholder="Ex: Utilizar chave de carcaça..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
                        </div>

                        <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md transition-all active:scale-[0.98]">
                            💾 Monitorar Ponto de Água
                        </button>
                    </form>
                </div>

                {/* TABELA DE PONTOS MONITORADOS */}
                <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Cronograma de Saturação de Refis</h3>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="pb-3">Ponto / Bebedouro</th>
                                    <th className="pb-3">Setor</th>
                                    <th className="pb-3">Vencimento</th>
                                    <th className="pb-3">Status</th>
                                    <th className="pb-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-xs">
                                {filtrosFiltrados.map((filtro) => (
                                    <tr key={filtro.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4">
                                            <div className="font-black text-slate-700 uppercase">{filtro.nome}</div>
                                            {filtro.equipamento_nome && (
                                                <div className="text-[10px] font-bold text-blue-600 mt-0.5">
                                                    🚰 Ativo: {filtro.equipamento_nome} {filtro.equipamento_patrimonio ? `(PAT: ${filtro.equipamento_patrimonio})` : ''}
                                                </div>
                                            )}
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Refil: {filtro.modelo_refil || 'Padrão'}</div>
                                        </td>
                                        <td className="py-4 font-bold text-blue-600 uppercase tracking-tight">{filtro.setor_nome}</td>
                                        <td className="py-4">
                                            <div className="font-bold text-slate-600">{formatarDataSemFuso(filtro.data_vencimento)}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">Última: {formatarDataSemFuso(filtro.data_ultima_troca)}</div>
                                        </td>
                                        <td className="py-4">
                                            <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                                                filtro.dias_restantes < 0 ? 'bg-red-50 text-red-600 border border-red-100' :
                                                filtro.dias_restantes <= 15 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-600 border border-green-100'
                                            }`}>
                                                {filtro.dias_restantes < 0 ? `🚨 Vencido há ${Math.abs(filtro.dias_restantes)} dias` :
                                                 filtro.dias_restantes === 0 ? '⚠️ Vence Hoje' : `✅ Restam ${filtro.dias_restantes} dias`}
                                            </span>
                                        </td>
                                        <td className="py-4 text-center">
                                            <button 
                                                onClick={() => { setFiltroSelecionado(filtro); setModalBaixa(true); }}
                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm active:scale-95 transition-transform"
                                            >
                                                🔄 Trocar Refil
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* MODAL DE SUBSTITUIÇÃO INTEGRADO AO ESTOQUE */}
            {modalBaixa && filtroSelecionado && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 text-dark">
                        <div className="bg-green-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
                            <span>🔄 Registro de Baixa e Movimentação de Refil</span>
                            <button type="button" onClick={() => setModalBaixa(false)} className="font-bold hover:text-red-200">✕</button>
                        </div>
                        <form onSubmit={handleRegistrarTroca} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase">Ponto Alvo</p>
                                <p className="text-sm font-black text-slate-700 uppercase mt-0.5">{filtroSelecionado.nome}</p>
                                {filtroSelecionado.equipamento_nome && (
                                    <p className="text-xs font-bold text-blue-600 uppercase mt-1">🚰 Bebedouro Vinculado: {filtroSelecionado.equipamento_nome}</p>
                                )}
                            </div>

                            {/* SELETOR DE REFIL DO ALMOXARIFADO FILTRADO */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Vincular Refil do Estoque (Deduzir Saldo)</label>
                                <select 
                                    className="w-full p-3 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-xs outline-none focus:bg-white focus:border-green-500"
                                    value={itemIdSelecionado}
                                    onChange={e => setItemIdSelecionado(e.target.value)}
                                >
                                    <option value="">⚠️ Apenas registrar a data (Sem gastar item do estoque)</option>
                                    {refisFiltrados.map(item => (
                                        <option key={item.id} value={item.id}>
                                            📦 {item.nome} {item.referencia ? `[REF: ${item.referencia}]` : ''} — Saldo: {item.quantidade} un. (R$ {Number(item.valor_unitario).toFixed(2)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {itemIdSelecionado && (
                                <div className="w-1/2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Quantidade Utilizada</label>
                                    <input 
                                        type="number" min="1" required
                                        className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-center font-bold bg-slate-50 outline-none focus:bg-white"
                                        value={qtdUsada}
                                        onChange={e => setQtdUsada(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Laudo / Observações Técnicas</label>
                                <textarea 
                                    required 
                                    value={obsIntervencao}
                                    onChange={e => setObsIntervencao(e.target.value)}
                                    className="w-full border-2 border-slate-100 bg-slate-50/50 focus:bg-white rounded-2xl p-4 h-24 focus:border-green-500 outline-none transition-all resize-none text-xs font-medium text-slate-700" 
                                    placeholder="Descreva a ação realizada..."
                                ></textarea>
                            </div>
                            
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModalBaixa(false)} className="flex-1 bg-slate-100 text-slate-400 py-3.5 rounded-xl font-black text-xs uppercase hover:bg-slate-200">Cancelar</button>
                                <button type="submit" className="flex-[2] bg-green-600 text-white py-3.5 rounded-xl font-black text-xs uppercase shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all">🔄 Confirmar Baixa de Insumo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ControleFiltros;