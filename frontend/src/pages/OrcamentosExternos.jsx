import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function OrcamentosExternos() {
  const [orcamentos, setOrcamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [chamadosDisponiveis, setChamadosDisponiveis] = useState([]);
  const [modalNovo, setModalNovo] = useState(false);
  const [carregandoChamados, setCarregandoChamados] = useState(false);

  const [fornecedorId, setFornecedorId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itensLote, setItensLote] = useState([]);

  const carregarDadosIniciais = useCallback(async () => {
    try {
      const [resOrc, resForn] = await Promise.all([
        fetch('/api/orcamentos-externos').then(r => r.ok ? r.json() : []),
        fetch('/api/fornecedores').then(r => r.ok ? r.json() : [])
      ]);
      setOrcamentos(Array.isArray(resOrc) ? resOrc : []);
      setFornecedores(Array.isArray(resForn) ? resForn : []);
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
    }
  }, []);

  const carregarChamados = useCallback(async (fId = '') => {
    setCarregandoChamados(true);
    try {
      const url = fId 
        ? `/api/orcamentos-externos/chamados-disponiveis?fornecedor_id=${fId}` 
        : '/api/orcamentos-externos/chamados-disponiveis';

      let res = await fetch(url);
      let data = [];

      if (res.ok) {
        data = await res.json();
      }

      // 🛡️ Fallback: se a rota dedicada vier vazia, consulta direto a rota mestra de chamados
      if (!Array.isArray(data) || data.length === 0) {
        const resGeral = await fetch('/api/chamados');
        if (resGeral.ok) {
          const todos = await resGeral.json();
          data = todos.filter(c => 
            (c.status === 'Aguardando Externa' || 
             c.status?.toLowerCase().includes('externa') || 
             Number(c.em_manutencao_externa) === 1) &&
            c.status !== 'Concluído'
          );
        }
      }

      setChamadosDisponiveis(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Erro ao buscar chamados disponíveis:', err);
      setChamadosDisponiveis([]);
    } finally {
      setCarregandoChamados(false);
    }
  }, []);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  useEffect(() => {
    if (modalNovo) {
      carregarChamados(fornecedorId);
    }
  }, [modalNovo, fornecedorId, carregarChamados]);

  const toggleChamadoNoLote = (ch) => {
    const existe = itensLote.find(i => i.chamado_id === ch.id);
    if (existe) {
      setItensLote(itensLote.filter(i => i.chamado_id !== ch.id));
    } else {
      setItensLote([...itensLote, {
        chamado_id: ch.id,
        equipamento_id: ch.equipamento_id,
        equipamento_nome: ch.equipamento_nome || ch.equip_nome || ch.titulo,
        patrimonio: ch.patrimonio || ch.equip_pat || 'S/P',
        num_serie: ch.num_serie || 'N/A',
        descricao_proposta: '',
        valor_unitario: ''
      }]);
    }
  };

  const atualizarItemLote = (chamadoId, campo, valor) => {
    setItensLote(itensLote.map(it => it.chamado_id === chamadoId ? { ...it, [campo]: valor } : it));
  };

  const totalCalculado = itensLote.reduce((acc, it) => acc + (Number(it.valor_unitario) || 0), 0);

  const handleSalvarLote = async (e) => {
    e.preventDefault();
    if (!fornecedorId) {
      return alert('Selecione a empresa prestadora / fornecedor.');
    }
    if (itensLote.length === 0) {
      return alert('Selecione pelo menos um chamado da lista para compor o lote.');
    }

    try {
      const res = await fetch('/api/orcamentos-externos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': 'admin'
        },
        body: JSON.stringify({
          fornecedor_id: fornecedorId,
          observacoes,
          itens: itensLote
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(`Orçamento ${data.codigo} registrado com sucesso! 📑✅`);
        setModalNovo(false);
        setItensLote([]);
        setFornecedorId('');
        setObservacoes('');
        carregarDadosIniciais();
      } else {
        alert(`Erro: ${data.error || 'Falha ao registrar orçamento.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao salvar orçamento.');
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase flex items-center gap-2">
            <span>📑</span> Orçamentos & Lotes Externos
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase mt-0.5">
            Consolidação de Propostas Comerciais para Envio ao Financeiro
          </p>
        </div>
        <button
          onClick={() => {
            setModalNovo(true);
            setItensLote([]);
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-2xl shadow-sm transition-all active:scale-95"
        >
          + Novo Lote de Orçamento
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
            <tr>
              <th className="p-4">Código</th>
              <th className="p-4">Fornecedor</th>
              <th className="p-4">Data</th>
              <th className="p-4 text-center">Itens (OS)</th>
              <th className="p-4 text-right">Valor Total</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orcamentos.map((orc) => (
              <tr key={orc.id} className="hover:bg-slate-50/50">
                <td className="p-4 font-black text-blue-600 font-mono">{orc.codigo_orcamento}</td>
                <td className="p-4 font-bold text-slate-700">{orc.fornecedor_nome}</td>
                <td className="p-4 text-slate-500 font-bold">{new Date(orc.data_emissao).toLocaleDateString('pt-BR')}</td>
                <td className="p-4 text-center font-bold">{orc.total_itens}</td>
                <td className="p-4 text-right font-black font-mono text-emerald-600">
                  R$ {Number(orc.valor_total).toFixed(2)}
                </td>
                <td className="p-4 text-center">
                  <Link
                    to={`/orcamentos-externos/${orc.id}/imprimir`}
                    target="_blank"
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    🖨️ Espelho Financeiro
                  </Link>
                </td>
              </tr>
            ))}
            {orcamentos.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center p-8 text-slate-400 font-bold italic">
                  Nenhum orçamento consolidado até o momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalNovo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black text-sm uppercase">Novo Lote de Orçamento Externo</h3>
              <button onClick={() => setModalNovo(false)} className="text-xl hover:text-slate-300">✕</button>
            </div>

            <form onSubmit={handleSalvarLote} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Fornecedor / Oficina *</label>
                <select
                  required
                  value={fornecedorId}
                  onChange={e => setFornecedorId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-xs outline-none bg-white focus:border-blue-500"
                >
                  <option value="">Selecione a empresa prestadora...</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>{f.nome_fantasia}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase">
                    Selecione os Chamados em Custódia Externa ({itensLote.length} selecionado(s))
                  </label>
                  <span className="text-[10px] font-bold text-slate-500">
                    {chamadosDisponiveis.length} OS disponível(is)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto border border-slate-200 p-2.5 rounded-2xl bg-slate-50">
                  {carregandoChamados && (
                    <p className="text-[11px] text-slate-400 italic p-4 col-span-2 text-center">Buscando chamados externos...</p>
                  )}

                  {!carregandoChamados && chamadosDisponiveis.map(ch => {
                    const selecionado = itensLote.some(i => i.chamado_id === ch.id);
                    const nomeAtivo = ch.equipamento_nome || ch.equip_nome || ch.titulo;
                    const patAtivo = ch.patrimonio || ch.equip_pat || 'S/P';
                    const setorAtivo = ch.setor_nome || 'Geral';

                    return (
                      <div
                        key={ch.id}
                        onClick={() => toggleChamadoNoLote(ch)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                          selecionado 
                            ? 'bg-blue-50 border-blue-500 shadow-xs' 
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          readOnly
                          className="mt-0.5 rounded text-blue-600 pointer-events-none"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-blue-600 font-mono">OS #{ch.id}</span>
                            <span className="text-[9px] font-bold uppercase text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                              {ch.status || 'Externa'}
                            </span>
                          </div>
                          <p className="font-bold text-slate-800 truncate mt-0.5">{nomeAtivo}</p>
                          <p className="text-[10px] text-slate-400">
                            Pat: <strong className="text-slate-600">{patAtivo}</strong> | Setor: {setorAtivo}
                          </p>
                        </div>
                      </div>
                    );
                  })}

                  {!carregandoChamados && chamadosDisponiveis.length === 0 && (
                    <div className="text-center p-5 col-span-2 text-slate-400">
                      <p className="text-xs font-bold">Nenhum chamado com status externo encontrado.</p>
                      <p className="text-[10px] mt-0.5">Certifique-se de que os chamados foram despachados para manutenção externa.</p>
                    </div>
                  )}
                </div>
              </div>

              {itensLote.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Discriminação dos Serviços e Valores do Orçamento:
                  </h4>
                  {itensLote.map(it => (
                    <div key={it.chamado_id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-black text-slate-800">
                        <span className="truncate pr-2">
                          OS #{it.chamado_id} — {it.equipamento_nome} {it.patrimonio !== 'S/P' ? `(Pat: ${it.patrimonio})` : ''}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-xs font-bold text-slate-500">R$</span>
                          <input
                            required
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={it.valor_unitario}
                            onChange={e => atualizarItemLote(it.chamado_id, 'valor_unitario', e.target.value)}
                            className="w-28 p-1.5 border border-slate-300 rounded-lg text-right font-mono font-bold text-xs outline-none bg-white focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <textarea
                        required
                        rows={2}
                        placeholder="Discrimine as peças e serviços informados (Ex: Induzido, Escovas de Carvão, Rolamentos...)"
                        value={it.descricao_proposta}
                        onChange={e => atualizarItemLote(it.chamado_id, 'descricao_proposta', e.target.value)}
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none resize-none bg-white focus:border-blue-500"
                      />
                    </div>
                  ))}
                  <div className="text-right text-sm font-black text-slate-800 pt-1">
                    Total Consolidado do Lote: <strong className="text-emerald-600 font-mono">R$ {totalCalculado.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Observações Internas para o Financeiro</label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: Cotação aprovada emergencialmente por WhatsApp..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalNovo(false)}
                  className="flex-1 py-3 bg-slate-100 font-black text-xs uppercase rounded-xl text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-[2] py-3 bg-blue-600 hover:bg-blue-700 font-black text-xs uppercase text-white rounded-xl shadow-md transition-all active:scale-95"
                >
                  Gerar Lote de Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}