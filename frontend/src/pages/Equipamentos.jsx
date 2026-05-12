import { useEffect, useState } from 'react'

const Equipamentos = () => {
  const [equipamentos, setEquipamentos] = useState([])
  const [busca, setBusca] = useState('')
  const [modalAberta, setModalAberta] = useState(false)
  const [manterAberta, setManterAberta] = useState(false)
  const [editandoId, setEditandoId] = useState(null) // Define se estamos editando ou criando

  const [setores, setSetores] = useState([])
  const [tipos, setTipos] = useState([])

  const estadoInicial = {
    nome: '', modelo: '', patrimonio: '', num_serie: '', fabricante: '',
    setor_id: '', tipo_id: '', valor: '', data_ultima_preventiva: '', status: 'Ativo'
  }
  const [form, setForm] = useState(estadoInicial)

  const carregarDados = () => {
    fetch('http://192.168.5.101:3000/api/equipamentos').then(res => res.json()).then(data => setEquipamentos(data))
  }

  useEffect(() => {
    carregarDados()
    fetch('http://192.168.5.101:3000/api/setores').then(res => res.json()).then(data => setSetores(data))
    fetch('http://192.168.5.101:3000/api/tipos').then(res => res.json()).then(data => setTipos(data))
  }, [])

  // Função para abrir modal de edição
  const prepararEdicao = (e) => {
    setEditandoId(e.id)
    setForm({
      ...e,
      data_ultima_preventiva: e.data_ultima_preventiva ? e.data_ultima_preventiva.split('T')[0] : ''
    })
    setModalAberta(true)
  }

  // Função para Excluir
  const excluir = (id) => {
    if (window.confirm("🚨 Tem certeza que deseja excluir este equipamento? Esta ação é permanente.")) {
      fetch(`http://192.168.5.101:3000/api/equipamentos/${id}`, { method: 'DELETE' })
        .then(() => carregarDados())
    }
  }

  const salvar = (e) => {
    e.preventDefault()
    const url = editandoId 
      ? `http://192.168.5.101:3000/api/equipamentos/${editandoId}` 
      : 'http://192.168.5.101:3000/api/equipamentos'
    
    fetch(url, {
      method: editandoId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    .then(() => {
      carregarDados()
      if (!manterAberta || editandoId) {
        setModalAberta(false)
        setEditandoId(null)
        setForm(estadoInicial)
      } else {
        setForm({ ...estadoInicial, setor_id: form.setor_id, tipo_id: form.tipo_id }) // Mantém contexto se for novo
      }
    })
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Ativos</h1>
        <div className="flex gap-3">
          <input type="text" placeholder="Buscar..." className="px-4 py-2 border rounded-xl w-64 outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setBusca(e.target.value)} />
          <button onClick={() => { setEditandoId(null); setForm(estadoInicial); setModalAberta(true); }} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all">+ Novo Ativo</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th className="p-4">Equipamento</th>
              <th className="p-4">Série / Patrimônio</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipamentos.filter(e => e.nome?.toLowerCase().includes(busca.toLowerCase())).map(e => (
              <tr key={e.id} className="hover:bg-slate-50/50">
                <td className="p-4">
                  <div className="font-bold text-slate-700">{e.nome}</div>
                  <div className="text-[10px] text-blue-500 font-bold uppercase tracking-tight">{e.setor_nome}</div>
                </td>
                <td className="p-4">
                  <div className="text-xs text-slate-400 font-mono">{e.num_serie || 'S/N'}</div>
                  <div className="text-xs font-black text-slate-600">{e.patrimonio}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-black ${e.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{e.status}</span>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-4">
                    <button onClick={() => prepararEdicao(e)} className="text-xl hover:scale-125 transition-transform">📝</button>
                    <button onClick={() => excluir(e.id)} className="text-xl hover:scale-125 transition-transform text-red-500">🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl animate-in zoom-in duration-200">
            <div className={`p-4 text-white font-bold flex justify-between ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
              <span>{editandoId ? 'Editar Equipamento' : 'Novo Equipamento'}</span>
              <button onClick={() => setModalAberta(false)}>✕</button>
            </div>
            <form onSubmit={salvar} className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nome</label>
                <input type="text" required value={form.nome} className="w-full p-2 border rounded-lg" onChange={e => setForm({...form, nome: e.target.value})} />
              </div>
              <input type="text" placeholder="Modelo" value={form.modelo} className="p-2 border rounded-lg" onChange={e => setForm({...form, modelo: e.target.value})} />
              <input type="text" placeholder="Fabricante" value={form.fabricante} className="p-2 border rounded-lg" onChange={e => setForm({...form, fabricante: e.target.value})} />
              <input type="text" placeholder="Patrimônio" value={form.patrimonio} className="p-2 border rounded-lg" onChange={e => setForm({...form, patrimonio: e.target.value})} />
              <input type="text" placeholder="Nº Série" value={form.num_serie} className="p-2 border rounded-lg" onChange={e => setForm({...form, num_serie: e.target.value})} />
              
              <select value={form.setor_id} className="p-2 border rounded-lg text-xs" onChange={e => setForm({...form, setor_id: e.target.value})}>
                <option value="">Setor...</option>
                {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              
              <select value={form.status} className="p-2 border rounded-lg text-xs" onChange={e => setForm({...form, status: e.target.value})}>
                <option value="Ativo">Ativo</option>
                <option value="Reserva">Reserva</option>
                <option value="Em Manutenção">Em Manutenção</option>
              </select>

              <div className="col-span-2 flex justify-between items-center border-t pt-4 mt-2">
                {!editandoId && (
                   <label className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <input type="checkbox" checked={manterAberta} onChange={e => setManterAberta(e.target.checked)} /> Manter Janela Aberta
                  </label>
                )}
                <div className="flex gap-2 ml-auto">
                  <button type="button" onClick={() => setModalAberta(false)} className="px-4 py-2 text-slate-400">Cancelar</button>
                  <button type="submit" className={`px-6 py-2 rounded-lg text-white font-bold ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
                    {editandoId ? 'Atualizar Dados' : 'Salvar Ativo'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Equipamentos
