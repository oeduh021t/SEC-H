import { useState, useEffect } from 'react';

export default function NotasFiscais() {
  // --- ESTADOS DO MÓDULO ---
  const [notas, setNotas] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Modais de Controle
  const [modalNotaAberto, setModalNotaAberto] = useState(false);
  const [modalBoletosAberto, setModalBoletosAberto] = useState(false);
  const [notaSelecionada, setNotaSelecionada] = useState(null);
  const [boletosNota, setBoletosNota] = useState([]);

  // Estados dos Formulários
  const [novaNota, setNovaNota] = useState({
    numero_nf: '', serie: '', chave_acesso: '', fornecedor_id: '',
    data_emissao: '', data_recebimento: '', valor_total: '', descricao: ''
  });
  const [arquivosNota, setArquivosNota] = useState({ xml: null, danfe: null });

  const [novoBoleto, setNovoBoleto] = useState({
    parcela: '1/1', codigo_barras: '', linha_digitavel: '', valor_boleto: '', data_vencimento: ''
  });
  const [arquivoBoleto, setArquivoBoleto] = useState(null);
  const [dataBaixa, setDataBaixa] = useState(new Date().toISOString().split('T')[0]);
  const [comprovanteBoleto, setComprovanteBoleto] = useState(null);

  const API_URL = 'http://192.168.5.101:3000/api';

  // Auxiliar para obter o nível (Garante o correto funcionamento caso o interceptor falhe em chamadas simultâneas)
  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  // --- BUSCA DE DADOS (Correção de Cabeçalho Aplicada) ---
  const carregarDados = async () => {
    setLoading(true);
    try {
      const opcoesFetch = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario()
        }
      };

      const [resNotas, resFornecedores] = await Promise.all([
        fetch(`${API_URL}/notas-fiscais`, opcoesFetch),
        fetch(`${API_URL}/fornecedores`, opcoesFetch)
      ]);
      
      const dataNotas = await resNotas.json();
      const dataFornecedores = await resFornecedores.json();
      
      setNotas(Array.isArray(dataNotas) ? dataNotas : []);
      setFornecedores(Array.isArray(dataFornecedores) ? dataFornecedores : []);
    } catch (err) {
      console.error('Erro ao conectar com a API do SEC-H:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const verBoletos = async (nota) => {
    setNotaSelecionada(nota);
    try {
      const res = await fetch(`${API_URL}/notas-fiscais/${nota.id}/boletos`, {
        method: 'GET',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      const data = await res.json();
      setBoletosNota(data);
      setModalBoletosAberto(true);
    } catch (err) {
      alert('Erro ao buscar boletos associados.');
    }
  };

  // --- SUBMISSÃO DE DADOS ---
  const handleSalvarNota = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(novaNota).forEach(key => formData.append(key, novaNota[key]));
    if (arquivosNota.xml) formData.append('xml', arquivosNota.xml);
    if (arquivosNota.danfe) formData.append('danfe', arquivosNota.danfe);

    try {
      const res = await fetch(`${API_URL}/notas-fiscais`, {
        method: 'POST',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });
      if (res.ok) {
        alert('Nota Fiscal registrada com sucesso!');
        setModalNotaAberto(false);
        setNovaNota({ numero_nf: '', serie: '', chave_acesso: '', fornecedor_id: '', data_emissao: '', data_recebimento: '', valor_total: '', descricao: '' });
        setArquivosNota({ xml: null, danfe: null });
        carregarDados();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error}`);
      }
    } catch (err) {
      alert('Falha na comunicação com o servidor.');
    }
  };

  const handleAnexarBoleto = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('nota_fiscal_id', notaSelecionada.id);
    Object.keys(novoBoleto).forEach(key => formData.append(key, novoBoleto[key]));
    if (arquivoBoleto) formData.append('boleto_pdf', arquivoBoleto);

    try {
      const res = await fetch(`${API_URL}/boletos`, {
        method: 'POST',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });
      if (res.ok) {
        alert('Boleto anexado!');
        setNovoBoleto({ parcela: '1/1', codigo_barras: '', linha_digitavel: '', valor_boleto: '', data_vencimento: '' });
        setArquivoBoleto(null);
        verBoletos(notaSelecionada);
      }
    } catch (err) {
      alert('Erro ao anexar boleto.');
    }
  };

  const handleBaixarBoleto = async (boletoId) => {
    const formData = new FormData();
    formData.append('data_pagamento', dataBaixa);
    if (comprovanteBoleto) formData.append('comprovante_pdf', comprovanteBoleto);

    try {
      const res = await fetch(`${API_URL}/boletos/${boletoId}/pagar`, {
        method: 'PATCH',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });
      if (res.ok) {
        alert('Boleto pago com sucesso!');
        setComprovanteBoleto(null);
        verBoletos(notaSelecionada);
      }
    } catch (err) {
      alert('Erro ao dar baixa no pagamento.');
    }
  };

  const handleExcluirNota = async (id) => {
    if (!window.confirm('🚨 Tem certeza? Isso apagará a nota e todos os seus boletos associados permanentemente.')) return;
    try {
      const res = await fetch(`${API_URL}/notas-fiscais/${id}`, { 
        method: 'DELETE',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      if (res.ok) {
        alert('Removido com sucesso!');
        carregarDados();
      }
    } catch (err) {
      alert('Erro ao excluir nota.');
    }
  };

  return (
    <div className="p-4 font-sans text-slate-800">
      {/* HEADER DA TELA */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <span className="bg-blue-100 p-2 rounded-lg text-blue-600 text-sm">🧾</span> GESTÃO DE NOTAS E BOLETOS
        </h1>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar por número de nota..."
            className="px-4 py-2 border-2 border-slate-100 rounded-xl w-72 outline-none focus:border-blue-500 transition-all text-sm font-medium bg-white text-black"
            onChange={e => setBusca(e.target.value)}
          />
          <button 
            onClick={() => setModalNotaAberto(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-sm uppercase tracking-wider"
          >
            + Lançar Nova Nota
          </button>
        </div>
      </div>

      {/* LISTAGEM PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Carregando dados financeiros do SEC-H...</div>
        ) : notas.length === 0 ? (
          <div className="p-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">Nenhuma nota fiscal cadastrada no sistema.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 tracking-widest uppercase border-b">
              <tr>
                <th className="p-5">Número / Série</th>
                <th className="p-5">Fornecedor</th>
                <th className="p-5">Emissão</th>
                <th className="p-5">Valor Total</th>
                <th className="p-5">Arquivos</th>
                <th className="p-5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {notas
                .filter(n => n.numero_nf?.toLowerCase().includes(busca.toLowerCase()))
                .map((nota) => (
                  <tr key={nota.id} className="hover:bg-slate-50/50 transition-colors group text-dark">
                    <td className="p-5 font-bold text-slate-700 text-sm">
                      {nota.numero_nf} <span className="text-slate-400 font-normal text-xs">({nota.serie || 'Única'})</span>
                    </td>
                    <td className="p-5 text-sm font-medium text-slate-600 uppercase">{nota.fornecedor_nome}</td>
                    <td className="p-5 text-xs font-mono">{new Date(nota.data_emissao).toLocaleDateString('pt-BR')}</td>
                    <td className="p-5 font-bold text-slate-700 text-sm">R$ {Number(nota.valor_total).toFixed(2)}</td>
                    <td className="p-5 space-x-2">
                      {nota.url_xml && <a href={`${API_URL.replace('/api', '')}${nota.url_xml}`} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-blue-50 text-blue-600 px-2 py-1 rounded uppercase hover:bg-blue-600 hover:text-white transition-all">XML</a>}
                      {nota.url_danfe && <a href={`${API_URL.replace('/api', '')}${nota.url_danfe}`} target="_blank" rel="noreferrer" className="text-[10px] font-black bg-purple-50 text-purple-600 px-2 py-1 rounded uppercase hover:bg-purple-600 hover:text-white transition-all">DANFE</a>}
                    </td>
                    <td className="p-5">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => verBoletos(nota)} className="px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm border border-green-100 text-xs font-black uppercase tracking-wider">
                          📁 Boletos
                        </button>
                        <button onClick={() => handleExcluirNota(nota.id)} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100" title="Remover Nota">
                          <span className="text-sm">🗑️</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* --- MODAL 1: CADASTRAR NOTA --- */}
      {modalNotaAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-blue-600">
              <span>🆕 Novo Lançamento Fiscal</span>
              <button onClick={() => setModalNotaAberto(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <form onSubmit={handleSalvarNota} className="p-8 grid grid-cols-2 gap-4 text-dark">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Número da NF *</label>
                <input type="text" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-sm bg-white text-black" value={novaNota.numero_nf} onChange={e => setNovaNota({...novaNota, numero_nf: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Série</label>
                <input type="text" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-medium bg-white text-black" value={novaNota.serie} onChange={e => setNovaNota({...novaNota, serie: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Chave de Acesso (44 dígitos)</label>
                <input type="text" maxLength={44} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono text-sm bg-white text-black tracking-widest" value={novaNota.chave_acesso} onChange={e => setNovaNota({...novaNota, chave_acesso: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fornecedor Vinculado *</label>
                <select required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-sm text-black" value={novaNota.fornecedor_id} onChange={e => setNovaNota({...novaNota, fornecedor_id: e.target.value})}>
                  <option value="">Selecione o Fornecedor</option>
                  {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome_fantasia}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Data de Emissão *</label>
                <input type="date" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm bg-white text-black" value={novaNota.data_emissao} onChange={e => setNovaNota({...novaNota, data_emissao: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor Total (R$) *</label>
                <input type="number" step="0.01" required className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-bold bg-white text-black" value={novaNota.valor_total} onChange={e => setNovaNota({...novaNota, valor_total: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Arquivo XML da Nota</label>
                <input type="file" accept=".xml" className="w-full text-xs font-mono p-1" onChange={e => setArquivosNota({...arquivosNota, xml: e.target.files[0]})} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Arquivo PDF DANFE</label>
                <input type="file" accept=".pdf" className="w-full text-xs font-mono p-1" onChange={e => setArquivosNota({...arquivosNota, danfe: e.target.files[0]})} />
              </div>

              {/* RODAPÉ DO FORMULÁRIO */}
              <div className="col-span-2 flex justify-end gap-3 border-t border-slate-50 pt-6 mt-4">
                <button type="button" onClick={() => setModalNotaAberto(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-8 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 bg-blue-600 shadow-blue-100">
                  Salvar Nota Fiscal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: GESTÃO DE BOLETOS VINCULADOS --- */}
      {modalBoletosAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-slate-800">
              <span>🗓️ Cronograma de Cobranças: NF #{notaSelecionada?.numero_nf}</span>
              <button onClick={() => setModalBoletosAberto(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* FORMULÁRIO DE ANEXAR NOVO BOLETO */}
              <form onSubmit={handleAnexarBoleto} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-4 gap-4 items-end">
                <div className="col-span-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Vincular Nova Parcela</div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Identificação/Parc</label>
                  <input type="text" className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold" value={novoBoleto.parcela} onChange={e => setNovoBoleto({...novoBoleto, parcela: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Valor da Parcela *</label>
                  <input type="number" step="0.01" required className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black font-bold" value={novoBoleto.valor_boleto} onChange={e => setNovoBoleto({...novoBoleto, valor_boleto: e.target.value})} />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Data de Vencimento *</label>
                  <input type="date" required className="w-full p-2 border-2 border-slate-100 rounded-xl outline-none text-xs bg-white text-black" value={novoBoleto.data_vencimento} onChange={e => setNovoBoleto({...novoBoleto, data_vencimento: e.target.value})} />
                </div>
                <div>
                  <button type="submit" className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-50">
                    + Incluir Parcela
                  </button>
                </div>
                <div className="col-span-4">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Documento PDF do Boleto</label>
                  <input type="file" accept=".pdf" className="text-xs font-mono" onChange={e => setArquivoBoleto(e.target.files[0])} />
                </div>
              </form>

              {/* LISTA DE COBRANÇAS */}
              <div className="space-y-3">
                <h3 className="font-black text-xs text-slate-400 uppercase tracking-widest">Duplicatas do Documento</h3>
                {boletosNota.length === 0 ? (
                  <p className="text-slate-400 text-xs font-bold uppercase text-center py-6 bg-slate-50/50 rounded-2xl">Nenhum boleto gerado para este faturamento.</p>
                ) : (
                  <div className="space-y-2">
                    {boletosNota.map(b => (
                      <div key={b.id} className="border border-slate-100 rounded-2xl p-4 bg-white flex justify-between items-center shadow-xs hover:border-slate-200 transition-all">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700 text-sm">Parcela {b.parcela}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${b.status_pagamento === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {b.status_pagamento}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 font-medium">Vencimento: <span className="font-mono text-slate-500">{new Date(b.data_vencimento).toLocaleDateString('pt-BR')}</span></div>
                          <div className="flex gap-2 pt-1">
                            {b.url_boleto_pdf && <a href={`${API_URL.replace('/api', '')}${b.url_boleto_pdf}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-500 hover:underline">📄 Ver Duplicata</a>}
                            {b.url_comprovante_pdf && <a href={`${API_URL.replace('/api', '')}${b.url_comprovante_pdf}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-green-600 hover:underline">🧾 Ver Recibo/Comprovante</a>}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-black text-slate-700 text-base">R$ {Number(b.valor_boleto).toFixed(2)}</div>
                          </div>
                          {b.status_pagamento !== 'Pago' && (
                            <div className="flex flex-col items-end gap-1.5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                              <input type="file" accept=".pdf" className="text-[9px] font-mono w-40" onChange={e => setComprovanteBoleto(e.target.files[0])} />
                              <button type="button" onClick={() => handleBaixarBoleto(b.id)} className="bg-green-600 hover:bg-green-700 text-white font-black text-[9px] px-3 py-1.5 rounded-lg shadow-sm uppercase tracking-wider transition-all">
                                Quitar Parcela
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}