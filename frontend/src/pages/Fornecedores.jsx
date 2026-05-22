import { useEffect, useState } from 'react'

const Fornecedores = () => {
  const [fornecedores, setFornecedores] = useState([])
  const [busca, setBusca] = useState('')
  const [modalAberta, setModalAberta] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  const estadoInicial = { 
    nome_fantasia: '', 
    razao_social: '', 
    cnpj: '', 
    contato: '', 
    telefone: '', 
    email: '', 
    especialidade: '', 
    status: 'Ativo' 
  }
  const [form, setForm] = useState(estadoInicial)

  const API_URL = 'http://192.168.5.101:3000/api'

  // Auxiliar para extrair o nível de privilégio atualizado do operador logado
  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  }

  // Carrega os dados do backend injetando o cabeçalho de validação
  const carregarFornecedores = () => {
    fetch(`${API_URL}/fornecedores`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario() // CORREÇÃO CONTRA ERRO 401
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then(data => setFornecedores(data || []))
      .catch(err => console.error("Erro ao buscar fornecedores:", err))
  }

  useEffect(() => { 
    carregarFornecedores() 
  }, [])

  // Prepara o formulário para edição
  const prepararEdicao = (f) => {
    setEditandoId(f.id)
    setForm({
      nome_fantasia: f.nome_fantasia || '',
      razao_social: f.razao_social || '',
      cnpj: f.cnpj || '',
      contato: f.contato || '',
      telefone: f.telefone || '',
      email: f.email || '',
      especialidade: f.especialidade || '',
      status: f.status || 'Ativo'
    })
    setModalAberta(true)
  }

  // Remove um fornecedor do banco injetando o cabeçalho de validação
  const excluirFornecedor = (id) => {
    if (window.confirm("🚨 Tem certeza que deseja remover este fornecedor? Esta ação é permanente.")) {
      fetch(`${API_URL}/fornecedores/${id}`, { 
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario() // CORREÇÃO CONTRA ERRO 401
        }
      })
        .then(res => {
          if (!res.ok) alert("Você não possui permissão para excluir registros.");
          carregarFornecedores();
        })
        .catch(err => console.error("Erro ao deletar fornecedor:", err))
    }
  }

  // Salva (Post) ou Atualiza (Put) os dados no banco injetando o cabeçalho de validação
  const salvar = (e) => {
    e.preventDefault()
    const url = editandoId ? `${API_URL}/fornecedores/${editandoId}` : `${API_URL}/fornecedores`

    fetch(url, {
      method: editandoId ? 'PUT' : 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario() // CORREÇÃO CONTRA ERRO 401
      },
      body: JSON.stringify(form)
    })
    .then(res => {
      if (res.ok) {
        carregarFornecedores()
        setModalAberta(false)
        setEditandoId(null)
        setForm(estadoInicial)
      } else {
        alert("Erro ao salvar os dados do fornecedor. Verifique suas permissões de acesso.")
      }
    })
    .catch(err => console.error("Erro na requisição salvar:", err))
  }

  return (
    <div className="p-4 font-sans text-slate-800">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
           <span className="bg-blue-100 p-2 rounded-lg text-blue-600 text-sm">🚚</span> GESTÃO DE FORNECEDORES
        </h1>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar fornecedor..."
            className="px-4 py-2 border-2 border-slate-100 rounded-xl w-72 outline-none focus:border-blue-500 transition-all text-sm font-medium bg-white"
            onChange={e => setBusca(e.target.value)}
          />
          <button
            onClick={() => { setEditandoId(null); setForm(estadoInicial); setModalAberta(true); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-sm uppercase tracking-wider"
          >
            + Novo Fornecedor
          </button>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th className="p-5">Empresa / Status</th>
              <th className="p-5">CNPJ / Especialidade</th>
              <th className="p-5">Contato / E-mail</th>
              <th className="p-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fornecedores
              .filter(f =>
                f.nome_fantasia?.toLowerCase().includes(busca.toLowerCase()) ||
                f.cnpj?.includes(busca)
              )
              .map(f => (
              <tr key={f.id} className="hover:bg-slate-50/50 transition-colors group text-dark">
                <td className="p-5">
                  <div className="font-bold text-slate-700 text-sm uppercase">{f.nome_fantasia}</div>
                  <div className="text-[10px] text-slate-400 font-bold tracking-tight truncate max-w-xs">{f.razao_social || 'Razão social não informada'}</div>
                  <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                    f.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {f.status}
                  </span>
                </td>
                <td className="p-5">
                  <div className="text-xs font-black text-slate-600 bg-slate-100 inline-block px-2 py-1 rounded font-mono uppercase">{f.cnpj || 'SEM CNPJ'}</div>
                  <div className="text-[10px] text-blue-500 font-black mt-1 uppercase tracking-wider">{f.especialidade || 'Geral'}</div>
                </td>
                <td className="p-5">
                  <div className="text-xs font-bold text-slate-700">Resp: {f.contato || '---'}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{f.email || '---'}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1">📞 {f.telefone || '---'}</div>
                </td>
                <td className="p-5">
                  <div className="flex justify-center gap-2">
                    {/* BOTÃO EDITAR */}
                    <button
                      onClick={() => prepararEdicao(f)}
                      className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-100"
                      title="Editar Fornecedor"
                    >
                      <span className="text-sm">✏️</span>
                    </button>

                    {/* BOTÃO EXCLUIR */}
                    <button
                      onClick={() => excluirFornecedor(f.id)}
                      className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
                      title="Remover Fornecedor"
                    >
                      <span className="text-sm">🗑️</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {fornecedores.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center p-10 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  Nenhum fornecedor cadastrado na base de dados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className={`p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
              <span>{editandoId ? '✏️ Editar Fornecedor' : '🆕 Novo Fornecedor'}</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110 transition-transform text-sm font-sans font-bold">✕</button>
            </div>

            <form onSubmit={salvar} className="p-8 grid grid-cols-2 gap-4 text-dark">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome Fantasia *</label>
                <input type="text" required value={form.nome_fantasia} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-sm" onChange={e => setForm({...form, nome_fantasia: e.target.value})} />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Razão Social</label>
                <input type="text" value={form.razao_social} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-medium" onChange={e => setForm({...form, razao_social: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">CNPJ</label>
                <input type="text" value={form.cnpj} placeholder="00.000.000/0001-00" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono text-sm" onChange={e => setForm({...form, cnpj: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Especialidade / Ramo</label>
                <input type="text" value={form.especialidade} placeholder="Ex: Engenharia Clínica, Refrigeração" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm" onChange={e => setForm({...form, especialidade: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Contato (Representante)</label>
                <input type="text" value={form.contato} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm" onChange={e => setForm({...form, contato: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Telefone Comercial</label>
                <input type="text" value={form.telefone} placeholder="(00) 00000-0000" className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-medium" onChange={e => setForm({...form, telefone: e.target.value})} />
              </div>

              <div className="col-span-2 grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">E-mail de Suporte / Comercial</label>
                  <input type="email" value={form.email} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-sm font-mono" onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Cadastral</label>
                  <select value={form.status} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-sm" onChange={e => setForm({...form, status: e.target.value})}>
                    <option value="Ativo">🟢 Ativo</option>
                    <option value="Inativo">🔴 Inativo</option>
                  </select>
                </div>
              </div>

              {/* RODAPÉ DO FORMULÁRIO */}
              <div className="col-span-2 flex justify-end gap-3 border-t border-slate-50 pt-6 mt-4">
                <button type="button" onClick={() => setModalAberta(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className={`px-8 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${editandoId ? 'bg-amber-500 shadow-amber-100' : 'bg-blue-600 shadow-blue-100'}`}>
                  {editandoId ? 'Atualizar Fornecedor' : 'Salvar Fornecedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Fornecedores;