import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const Equipamentos = () => {
  const [equipamentos, setEquipamentos] = useState([])
  const [busca, setBusca] = useState('')
  const [modalAberta, setModalAberta] = useState(false)
  const [manterAberta, setManterAberta] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  
  // --- NOVOS ESTADOS PARA O CONTROLE DO QR CODE ---
  const [qrZoomUrl, setQrZoomUrl] = useState(null)

  const [setores, setSetores] = useState([])
  const [tipos, setTipos] = useState([])

  const estadoInicial = {
    nome: '', modelo: '', patrimonio: '', num_serie: '', fabricante: '',
    setor_id: '', tipo_id: '', valor: '', data_ultima_preventiva: '', status: 'Ativo'
  }
  const [form, setForm] = useState(estadoInicial)

  const API_URL = 'http://192.168.5.101:3000/api'

  // --- FUNÇÃO PARA GERAR O LINK DO QR CODE (IGUAL AO PHP) ---
  const gerarLinkQRCodeLocal = (id) => {
    // Aponta para a rota correspondente no ecossistema do seu novo frontend/sistema
    const urlDestino = `${window.location.origin}/prontuario/${id}`
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(urlDestino)}`
  }

  const carregarDados = () => {
    fetch(`${API_URL}/equipamentos`).then(res => res.json()).then(data => setEquipamentos(data))
  }

  useEffect(() => {
    carregarDados()
    fetch(`${API_URL}/setores`).then(res => res.json()).then(data => setSetores(data))
    fetch(`${API_URL}/tipos`).then(res => res.json()).then(data => setTipos(data))
  }, [])

  const prepararEdicao = (e) => {
    setEditandoId(e.id)
    setForm({
      ...e,
      data_ultima_preventiva: e.data_ultima_preventiva ? e.data_ultima_preventiva.split('T')[0] : ''
    })
    setModalAberta(true)
  }

  const excluir = (id) => {
    if (window.confirm("🚨 Tem certeza que deseja excluir este equipamento? Esta ação é permanente.")) {
      fetch(`${API_URL}/equipamentos/${id}`, { method: 'DELETE' })
        .then(() => carregarDados())
    }
  }

  const salvar = (e) => {
    e.preventDefault()
    const url = editandoId ? `${API_URL}/equipamentos/${editandoId}` : `${API_URL}/equipamentos`

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
        setForm({ ...estadoInicial, setor_id: form.setor_id, tipo_id: form.tipo_id })
      }
    })
  }

  return (
    <div className="p-4">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
           <span className="bg-blue-100 p-2 rounded-lg text-blue-600 text-sm">🛠️</span> GESTÃO DE ATIVOS
        </h1>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Buscar por nome ou patrimônio..."
            className="px-4 py-2 border-2 border-slate-100 rounded-xl w-72 outline-none focus:border-blue-500 transition-all text-sm font-medium"
            onChange={e => setBusca(e.target.value)}
          />
          <button
            onClick={() => { setEditandoId(null); setForm(estadoInicial); setModalAberta(true); }}
            className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-sm uppercase tracking-wider"
          >
            + Novo Ativo
          </button>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
            <tr>
              <th className="p-5">Equipamento / Setor</th>
              <th className="p-5">Patrimônio / Série</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-center">QR</th> {/* ADICIONADO TH DO QR */}
              <th className="p-5 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {equipamentos
              .filter(e =>
                e.nome?.toLowerCase().includes(busca.toLowerCase()) ||
                e.patrimonio?.toLowerCase().includes(busca.toLowerCase())
              )
              .map(e => (
              <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group text-dark">
                <td className="p-5">
                  <div className="font-bold text-slate-700 text-sm">{e.nome}</div>
                  <div className="text-[10px] text-blue-500 font-black uppercase tracking-tight">{e.setor_nome || 'Setor não definido'}</div>
                </td>
                <td className="p-5">
                  <div className="text-xs font-black text-slate-600 bg-slate-100 inline-block px-2 py-1 rounded font-mono uppercase">{e.patrimonio || 'S/P'}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Série: {e.num_serie || '---'}</div>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    e.status === 'Ativo' ? 'bg-green-100 text-green-700' :
                    e.status === 'Reserva' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {e.status}
                  </span>
                </td>
                
                {/* TD DO QR CODE RE-IMPLEMENTADO COM ESTILO PREMIUM */}
                <td className="p-5 text-center">
                  <button 
                    onClick={() => setQrZoomUrl(gerarLinkQRCodeLocal(e.id))}
                    className="inline-block p-1 bg-slate-50 border border-slate-200 rounded-lg hover:scale-110 active:scale-95 transition-all shadow-sm"
                    title="Visualizar QR Code"
                  >
                    <img src={gerarLinkQRCodeLocal(e.id)} alt="QR Thumb" className="w-8 h-8 rounded" />
                  </button>
                </td>

                <td className="p-5">
                  <div className="flex justify-center gap-2">
                    <Link
                      to={`/prontuario/${e.id}`}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100"
                      title="Ver Prontuário Clínico"
                    >
                      <span className="text-sm">📋</span>
                    </Link>

                    <button
                      onClick={() => prepararEdicao(e)}
                      className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-500 hover:text-white transition-all shadow-sm border border-amber-100"
                      title="Editar Ativo"
                    >
                      <span className="text-sm">✏️</span>
                    </button>

                    <button
                      onClick={() => excluir(e.id)}
                      className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100"
                      title="Remover do Inventário"
                    >
                      <span className="text-sm">🗑️</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className={`p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
              <span>{editandoId ? '✏️ Editar Equipamento' : '🆕 Novo Equipamento'}</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110 transition-transform">✕</button>
            </div>

            <form onSubmit={salvar} className="p-8 grid grid-cols-2 gap-4 text-dark">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Equipamento</label>
                <input type="text" required value={form.nome} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 transition-all font-bold" onChange={e => setForm({...form, nome: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Modelo</label>
                <input type="text" value={form.modelo} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none" onChange={e => setForm({...form, modelo: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fabricante</label>
                <input type="text" value={form.fabricante} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none" onChange={e => setForm({...form, fabricante: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Patrimônio</label>
                <input type="text" value={form.patrimonio} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono" onChange={e => setForm({...form, patrimonio: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Série</label>
                <input type="text" value={form.num_serie} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none" onChange={e => setForm({...form, num_serie: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Setor Responsável</label>
                <select value={form.setor_id} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-sm" onChange={e => setForm({...form, setor_id: e.target.value})}>
                  <option value="">Selecione o Setor...</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Operacional</label>
                <select value={form.status} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-sm" onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="Ativo">🟢 Ativo</option>
                  <option value="Reserva">🔵 Reserva</option>
                  <option value="Em Manutenção">🟡 Em Manutenção</option>
                </select>
              </div>

              <div className="col-span-2 flex justify-between items-center border-t border-slate-50 pt-6 mt-4">
                {!editandoId ? (
                  <label className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase cursor-pointer select-none">
                    <input type="checkbox" className="w-4 h-4 rounded border-2 border-slate-200 text-blue-600" checked={manterAberta} onChange={e => setManterAberta(e.target.checked)} />
                    Manter janela aberta após salvar
                  </label>
                ) : <div />}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setModalAberta(false)} className="px-6 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                  <button type="submit" className={`px-8 py-3 rounded-2xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 ${editandoId ? 'bg-amber-500 shadow-amber-100' : 'bg-blue-600 shadow-blue-100'}`}>
                    {editandoId ? 'Atualizar Dados' : 'Salvar no Inventário'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NOVO MODAL: ZOOM DO QR CODE RE-IMPLEMENTADO EM REACT --- */}
      {qrZoomUrl && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 border border-slate-100">
            <div className="p-4 bg-amber-500 text-white font-black uppercase text-[10px] tracking-widest flex justify-between items-center">
              <span className="flex items-center gap-2">🔍 QR CODE DO ATIVO</span>
              <button onClick={() => setQrZoomUrl(null)} className="hover:scale-110 transition-transform font-sans text-sm font-bold">✕</button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center bg-white">
              <img src={qrZoomUrl} alt="QR Code Expandido" className="w-48 h-48 rounded-2xl shadow-md p-2 bg-slate-50 border border-slate-100" />
              <p className="mt-4 text-[10px] text-slate-400 font-black tracking-widest uppercase text-center">
                Escaneie para acessar o prontuário
              </p>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => setQrZoomUrl(null)} 
                className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Equipamentos;
