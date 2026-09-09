import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

export default function OrcamentosExternos() {
  const [orcamentos, setOrcamentos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [setores, setSetores] = useState([]);
  const [chamadosDisponiveis, setChamadosDisponiveis] = useState([]);
  const [modalNovo, setModalNovo] = useState(false);
  const [carregandoChamados, setCarregandoChamados] = useState(false);
  const [processandoAprovacao, setProcessandoAprovacao] = useState(null);

  // Form State
  const [fornecedorId, setFornecedorId] = useState('');
  const [setorGeralId, setSetorGeralId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itensLote, setItensLote] = useState([]);
  const [arquivoAnexo, setArquivoAnexo] = useState(null);

  // Form temporário para item avulso/predial
  const [novoAvulsoTitulo, setNovoAvulsoTitulo] = useState('');
  const [novoAvulsoDesc, setNovoAvulsoDesc] = useState('');
  const [novoAvulsoValor, setNovoAvulsoValor] = useState('');

  // 🛡️ Helper para montar os headers de privilégio e autenticação
  const obterHeadersAuth = useCallback(() => {
    const nivel = localStorage.getItem('usuario_nivel') || localStorage.getItem('nivel') || 'admin';
    const usuarioId = localStorage.getItem('usuario_id') || localStorage.getItem('id') || '1';
    const token = localStorage.getItem('token') || '';

    const headers = {
      'x-usuario-nivel': nivel.toLowerCase(),
      'x-usuario-id': usuarioId
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }, []);

  const carregarDadosIniciais = useCallback(async () => {
    try {
      const headers = {
        ...obterHeadersAuth(),
        'Content-Type': 'application/json'
      };

      const [resOrc, resForn, resSet] = await Promise.all([
        fetch('/api/orcamentos-externos', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/fornecedores', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/setores', { headers }).then(r => r.ok ? r.json() : [])
      ]);

      setOrcamentos(Array.isArray(resOrc) ? resOrc : []);
      setFornecedores(Array.isArray(resForn) ? resForn : []);
      setSetores(Array.isArray(resSet) ? resSet : []);
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
    }
  }, [obterHeadersAuth]);

  const carregarChamados = useCallback(async (fId = '') => {
    setCarregandoChamados(true);
    try {
      const headers = {
        ...obterHeadersAuth(),
        'Content-Type': 'application/json'
      };

      const url = fId 
        ? `/api/orcamentos-externos/chamados-disponiveis?fornecedor_id=${fId}` 
        : '/api/orcamentos-externos/chamados-disponiveis';

      let res = await fetch(url, { headers });
      let data = [];
      if (res.ok) data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        const resGeral = await fetch('/api/chamados', { headers });
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
  }, [obterHeadersAuth]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  useEffect(() => {
    if (modalNovo) {
      carregarChamados(fornecedorId);
    }
  }, [modalNovo, fornecedorId, carregarChamados]);

  // Manipulação de OS vinculada
  const toggleChamadoNoLote = (ch) => {
    const existe = itensLote.find(i => i.chamado_id === ch.id);
    if (existe) {
      setItensLote(itensLote.filter(i => i.chamado_id !== ch.id));
    } else {
      setItensLote([...itensLote, {
        temp_id: `os-${ch.id}`,
        chamado_id: ch.id,
        item_titulo: `OS #${ch.id} — ${ch.equipamento_nome || ch.titulo}`,
        equipamento_id: ch.equipamento_id,
        equipamento_nome: ch.equipamento_nome || ch.equip_nome || ch.titulo,
        patrimonio: ch.patrimonio || ch.equip_pat || 'S/P',
        descricao_proposta: '',
        valor_unitario: ''
      }]);
    }
  };

  // Adicionar item manual/predial sem OS
  const adicionarItemAvulso = () => {
    if (!novoAvulsoTitulo.trim() || !novoAvulsoValor) {
      return alert('Informe o título do serviço e o valor unitário.');
    }

    const novoItem = {
      temp_id: `avulso-${Date.now()}`,
      chamado_id: null,
      item_titulo: novoAvulsoTitulo,
      equipamento_id: null,
      equipamento_nome: 'Serviço Predial / Infraestrutura',
      patrimonio: 'N/A',
      descricao_proposta: novoAvulsoDesc,
      valor_unitario: novoAvulsoValor
    };

    setItensLote([...itensLote, novoItem]);
    setNovoAvulsoTitulo('');
    setNovoAvulsoDesc('');
    setNovoAvulsoValor('');
  };

  const removerItemLote = (tempId) => {
    setItensLote(itensLote.filter(i => i.temp_id !== tempId));
  };

  const atualizarItemLote = (tempId, campo, valor) => {
    setItensLote(itensLote.map(it => it.temp_id === tempId ? { ...it, [campo]: valor } : it));
  };

  const totalCalculado = itensLote.reduce((acc, it) => acc + (Number(it.valor_unitario) || 0), 0);

  const handleSalvarLote = async (e) => {
    e.preventDefault();
    if (!fornecedorId) {
      return alert('Selecione o prestador / fornecedor.');
    }
    if (itensLote.length === 0) {
      return alert('Adicione pelo menos um item avulso ou selecione uma OS para compor o orçamento.');
    }

    try {
      const formData = new FormData();
      formData.append('fornecedor_id', fornecedorId);
      if (setorGeralId) formData.append('setor_id', setorGeralId);
      if (observacoes) formData.append('observacoes', observacoes);
      formData.append('itens', JSON.stringify(itensLote));
      if (arquivoAnexo) {
        formData.append('anexo', arquivoAnexo);
      }

      const headers = obterHeadersAuth();

      const res = await fetch('/api/orcamentos-externos', {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(`Orçamento ${data.codigo} registrado com sucesso! 📑✅`);
        setModalNovo(false);
        setItensLote([]);
        setFornecedorId('');
        setSetorGeralId('');
        setObservacoes('');
        setArquivoAnexo(null);
        carregarDadosIniciais();
      } else {
        alert(`Erro: ${data.error || 'Falha ao registrar orçamento.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao salvar orçamento.');
    }
  };

  // 💰 Ação de Aprovação e Lançamento nas Despesas Prediais
  const handleAprovarOrcamento = async (orc) => {
    const confirmar = window.confirm(
      `Deseja realmente APROVAR o orçamento ${orc.codigo_orcamento} no valor de R$ ${Number(orc.valor_total).toFixed(2)}?\n\nIsso irá lançar o gasto no centro de custos do setor predial e autorizar a execução.`
    );
    if (!confirmar) return;

    setProcessandoAprovacao(orc.id);
    try {
      const headers = {
        ...obterHeadersAuth(),
        'Content-Type': 'application/json'
      };

      const res = await fetch(`/api/orcamentos-externos/${orc.id}/aprovar`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          forma_pagamento: orc.observacoes || 'Conforme Proposta Comercial',
          justificativa: 'Aprovado pela coordenação / diretoria para execução imediata'
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(data.message || 'Orçamento aprovado e lançado no centro de custos! 💰');
        carregarDadosIniciais();
      } else {
        alert(`Erro: ${data.error || 'Falha ao aprovar orçamento.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao processar aprovação.');
    } finally {
      setProcessandoAprovacao(null);
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
            Gestão de Propostas Comerciais, Obras e Manutenções
          </p>
        </div>
        <button
          onClick={() => {
            setModalNovo(true);
            setItensLote([]);
            setArquivoAnexo(null);
          }}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase rounded-2xl shadow-sm transition-all active:scale-95"
        >
          + Novo Orçamento
        </button>
      </div>

      {/* Tabela de Orçamentos */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase">
            <tr>
              <th className="p-4">Código</th>
              <th className="p-4">Fornecedor</th>
              <th className="p-4">Setor / Obra</th>
              <th className="p-4">Data</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-center">Itens</th>
              <th className="p-4 text-right">Valor Total</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orcamentos.map((orc) => {
              const estaAprovado = orc.status === 'Aprovado Financeiro';
              return (
                <tr key={orc.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-black text-blue-600 font-mono">{orc.codigo_orcamento}</td>
                  <td className="p-4 font-bold text-slate-700">{orc.fornecedor_nome || 'Prestador Avulso'}</td>
                  <td className="p-4 font-bold text-slate-500">{orc.setor_nome || 'Geral / Predial'}</td>
                  <td className="p-4 text-slate-500 font-bold">{new Date(orc.data_emissao).toLocaleDateString('pt-BR')}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase inline-block ${
                      estaAprovado
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {estaAprovado ? '✅ Aprovado' : '⏳ Pendente'}
                    </span>
                  </td>
                  <td className="p-4 text-center font-bold">{orc.total_itens}</td>
                  <td className="p-4 text-right font-black font-mono text-emerald-600">
                    R$ {Number(orc.valor_total).toFixed(2)}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {!estaAprovado && (
                        <button
                          onClick={() => handleAprovarOrcamento(orc)}
                          disabled={processandoAprovacao === orc.id}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-xs active:scale-95"
                          title="Aprovar e lançar nas despesas prediais"
                        >
                          {processandoAprovacao === orc.id ? 'Aprovando...' : 'Aprovar'}
                        </button>
                      )}

                      {orc.anexo_url && (
                        <a
                          href={orc.anexo_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase transition-colors shadow-xs"
                          title="Abrir Anexo Original"
                        >
                          📎 Anexo
                        </a>
                      )}

                      <Link
                        to={`/orcamentos-externos/${orc.id}/imprimir`}
                        target="_blank"
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase transition-colors shadow-xs"
                      >
                        🖨️ Espelho
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {orcamentos.length === 0 && (
              <tr>
                <td colSpan="8" className="text-center p-8 text-slate-400 font-bold italic">
                  Nenhum orçamento consolidado até o momento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Novo Orçamento */}
      {modalNovo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-slate-900 p-5 text-white flex justify-between items-center shrink-0">
              <h3 className="font-black text-sm uppercase">Novo Orçamento Comercial (Com ou Sem OS)</h3>
              <button onClick={() => setModalNovo(false)} className="text-xl hover:text-slate-300">✕</button>
            </div>

            <form onSubmit={handleSalvarLote} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Prestador / Fornecedor *</label>
                  <select
                    required
                    value={fornecedorId}
                    onChange={e => setFornecedorId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-xs bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Selecione a empresa prestadora...</option>
                    {fornecedores.map(f => (
                      <option key={f.id} value={f.id}>{f.nome_fantasia || f.razao_social}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Setor Destino / Obra (Opcional)</label>
                  <select
                    value={setorGeralId}
                    onChange={e => setSetorGeralId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-bold text-xs bg-white focus:border-blue-500 outline-none"
                  >
                    <option value="">Geral / Manutenção Predial</option>
                    {setores.map(s => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bloco 1: Inclusão Manual de Serviços (Predial / Avulso) */}
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                  🔨 Adicionar Serviço Avulso / Predial (Sem OS)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Ex: Cobertura de dutos e fios em chapa galvanizada"
                      value={novoAvulsoTitulo}
                      onChange={e => setNovoAvulsoTitulo(e.target.value)}
                      className="w-full p-2 text-xs border border-amber-200 bg-white rounded-lg font-bold outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Valor R$ (Ex: 1224.00)"
                      value={novoAvulsoValor}
                      onChange={e => setNovoAvulsoValor(e.target.value)}
                      className="w-full p-2 text-xs border border-amber-200 bg-white rounded-lg font-bold font-mono outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <textarea
                  rows={2}
                  placeholder="Detalhamento técnico (Ex: Medindo 15mts lineares, chapa galvanizada e cantoneiras...)"
                  value={novoAvulsoDesc}
                  onChange={e => setNovoAvulsoDesc(e.target.value)}
                  className="w-full p-2 text-xs border border-amber-200 bg-white rounded-lg outline-none resize-none focus:border-amber-500"
                />
                <div className="text-right">
                  <button
                    type="button"
                    onClick={adicionarItemAvulso}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] uppercase rounded-xl shadow-xs transition-all active:scale-95"
                  >
                    + Incluir Item no Orçamento
                  </button>
                </div>
              </div>

              {/* Bloco 2: Seleção Opcional de Ordens de Serviço */}
              <details className="border border-slate-200 rounded-2xl p-3 group">
                <summary className="cursor-pointer text-[10px] font-black text-slate-500 uppercase flex justify-between items-center select-none">
                  <span>Opção: Selecionar Chamados / OSs em Aberto ({itensLote.filter(i => i.chamado_id).length} vinculados)</span>
                  <span className="text-xs text-blue-600 font-bold group-open:rotate-180 transition-transform">▼</span>
                </summary>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto mt-3 border-t border-slate-100 pt-2">
                  {carregandoChamados && (
                    <p className="text-[11px] text-slate-400 italic p-3 col-span-2 text-center">Buscando chamados...</p>
                  )}
                  {!carregandoChamados && chamadosDisponiveis.map(ch => {
                    const selecionado = itensLote.some(i => i.chamado_id === ch.id);
                    return (
                      <div
                        key={ch.id}
                        onClick={() => toggleChamadoNoLote(ch)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-start gap-2 select-none ${
                          selecionado ? 'bg-blue-50 border-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input type="checkbox" checked={selecionado} readOnly className="mt-0.5 pointer-events-none" />
                        <div className="min-w-0 flex-1">
                          <span className="font-black text-blue-600 font-mono">OS #{ch.id}</span>
                          <p className="font-bold text-slate-700 truncate">{ch.equipamento_nome || ch.titulo}</p>
                          <p className="text-[9px] text-slate-400">Pat: {ch.patrimonio || 'S/P'}</p>
                        </div>
                      </div>
                    );
                  })}
                  {!carregandoChamados && chamadosDisponiveis.length === 0 && (
                    <p className="text-[11px] text-slate-400 p-2 col-span-2 text-center italic">Nenhuma OS em manutenção externa no momento.</p>
                  )}
                </div>
              </details>

              {/* Lista Consolidada de Itens */}
              {itensLote.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    Itens que Comporão o Orçamento ({itensLote.length}):
                  </h4>
                  {itensLote.map(it => (
                    <div key={it.temp_id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center text-xs font-black text-slate-800">
                        <span className="truncate pr-2">
                          {it.chamado_id ? `🔧 OS #${it.chamado_id} - ${it.equipamento_nome}` : `🧱 ${it.item_titulo}`}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500">R$</span>
                          <input
                            required
                            type="number"
                            step="0.01"
                            value={it.valor_unitario}
                            onChange={e => atualizarItemLote(it.temp_id, 'valor_unitario', e.target.value)}
                            className="w-24 p-1.5 border border-slate-300 rounded-lg text-right font-mono font-bold text-xs bg-white focus:border-blue-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removerItemLote(it.temp_id)}
                            className="text-red-500 hover:text-red-700 font-bold px-1"
                            title="Remover Item"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Especificações do item/serviço..."
                        value={it.descricao_proposta}
                        onChange={e => atualizarItemLote(it.temp_id, 'descricao_proposta', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-white resize-none outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                  <div className="text-right text-sm font-black text-slate-800 pt-1">
                    Total Geral: <strong className="text-emerald-600 font-mono">R$ {totalCalculado.toFixed(2)}</strong>
                  </div>
                </div>
              )}

              {/* Anexo de Arquivo */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">
                  Cópia do Orçamento / Anexo (PDF, Foto ou Documento)
                </label>
                <input
                  type="file"
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={e => setArquivoAnexo(e.target.files[0])}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              {/* Observações */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Observações / Condições de Pagamento</label>
                <textarea
                  rows={2}
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: 50% no pedido e 50% na entrega. Chave Pix: 21974763231 (Nubank)"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs resize-none outline-none focus:border-blue-500"
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
                  Salvar Orçamento (R$ {totalCalculado.toFixed(2)})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}