import { useEffect, useState } from 'react';

const GestaoLocais = () => {
  const [locais, setLocais] = useState([]);
  const [busca, setBusca] = useState('');
  const [modalAberta, setModalAberta] = useState(false);

  const estadoInicial = { nome: '', descricao: '' };
  const [form, setForm] = useState(estadoInicial);

  const API_URL = 'http://192.168.5.101:3000/api';

  // Auxiliar para capturar o privilégio do operador logado
  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarLocais = () => {
    fetch(`${API_URL}/locais-estoque`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      }
    })
      .then(res => res.json())
      .then(data => setLocais(data || []))
      .catch(err => console.error("Erro ao buscar locais de estoque:", err));
  };

  useEffect(() => {
    carregarLocais();
  }, []);

  const salvar = (e) => {
    e.preventDefault();

    fetch(`${API_URL}/locais-estoque`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: JSON.stringify(form)
    })
      .then(res => {
        if (res.ok) {
          carregarLocais();
          setModalAberta(false);
          setForm(estadoInicial);
        } else {
          alert("Erro ao salvar o local de estoque. Verifique suas permissões.");
        }
      })
      .catch(err => console.error("Erro na requisição salvar:", err));
  };

  return (
    <div className="p-4 font-sans text-slate-800">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <span className="bg-blue-100 p-2 rounded-lg text-blue-600 text-sm">🏢</span> ESCOPOS E LOCAIS DE ESTOQUE
        </h1>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar local..."
            className="px-4 py-2 border-2 border-slate-100 rounded-xl w-72 outline-none focus:border-blue-500 transition-all text-sm font-medium bg-white text-black"
            onChange={e => setBusca(e.target.value)}
          />
          <button
            onClick={() => { setForm(estadoInicial); setModalAberta(true); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-sm uppercase tracking-wider"
          >
            + Novo Escopo
          </button>
        </div>
      </div>

      {/* Tabela Principal */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th className="p-5">Nome do Escopo / Local</th>
              <th className="p-5">Descrição / Finalidade</th>
              <th className="p-5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {locais
              .filter(l => l.nome?.toLowerCase().includes(busca.toLowerCase()))
              .map(l => (
                <tr key={l.id} className="hover:bg-slate-50/50 transition-colors text-dark">
                  <td className="p-5">
                    <div className="font-bold text-slate-700 text-sm uppercase">{l.nome}</div>
                  </td>
                  <td className="p-5 text-xs text-slate-500 font-medium">
                    {l.descricao || 'Nenhuma descrição informada.'}
                  </td>
                  <td className="p-5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      l.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            {locais.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center p-10 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  Nenhum local de estoque cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Cadastro */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center bg-blue-600">
              <span>🆕 Novo Local de Estoque / Escopo</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <form onSubmit={salvar} className="p-8 space-y-4 text-dark">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Escopo *</label>
                <input type="text" required placeholder="Ex: Engenharia Clínica, Manutenção, TI" value={form.nome} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-sm bg-white text-black" onChange={e => setForm({ ...form, nome: e.target.value })} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Descrição</label>
                <textarea rows="3" placeholder="Descreva brevemente o escopo de atuação ou localização física..." value={form.descricao} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-medium bg-white text-black resize-none" onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-50">
                <button type="button" onClick={() => setModalAberta(false)} className="flex-1 bg-slate-100 text-slate-400 py-3 rounded-xl font-black text-xs uppercase">Cancelar</button>
                <button type="submit" className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-wider shadow-xl shadow-blue-100 active:scale-95 transition-all">Salvar Local</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestaoLocais;