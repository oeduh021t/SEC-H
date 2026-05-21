import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const Equipamentos = () => {
  const [equipamentos, setEquipamentos] = useState([])
  const [busca, setBusca] = useState('')
  const [modalAberta, setModalAberta] = useState(false)
  const [manterAberta, setManterAberta] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  
  // NOVOS ESTADOS PARA O CONTROLE DO QR CODE E IMPRESSÃO
  const [qrZoomUrl, setQrZoomUrl] = useState(null)
  const [ativoSelecionadoQR, setAtivoSelecionadoQR] = useState(null)

  const [setores, setSetores] = useState([])
  const [tipos, setTipos] = useState([])

  // Filtros adicionais na barra superior
  const [filtroSetor, setFiltroSetor] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const estadoInicial = {
    nome: '', modelo: '', patrimonio: '', num_serie: '', fabricante: '',
    setor_id: '', tipo_id: '', valor: '', data_ultima_preventiva: '', status: 'Ativo'
  }
  const [form, setForm] = useState(estadoInicial)

  const API_URL = 'http://192.168.5.101:3000/api'

  const gerarLinkQRCodeLocal = (id) => {
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
      fetch(`${API_URL}/equipamentos/${id}`, { method: 'DELETE' }).then(() => carregarDados())
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

  // FILTRAGEM GLOBAL MULTI-CAMPO EM TEMPO REAL
  const equipamentosFiltrados = equipamentos.filter(e => {
    const termo = busca.toLowerCase();
    
    const matchesBusca = 
      (e.nome && e.nome.toLowerCase().includes(termo)) ||
      (e.patrimonio && e.patrimonio.toLowerCase().includes(termo)) ||
      (e.num_serie && e.num_serie.toLowerCase().includes(termo)) ||
      (e.fabricante && e.fabricante.toLowerCase().includes(termo));

    const matchesSetor = filtroSetor === 'todos' || String(e.setor_id) === String(filtroSetor);
    const matchesStatus = filtroStatus === 'todos' || e.status === filtroStatus;

    return matchesBusca && matchesSetor && matchesStatus;
  });

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* CSS ISOLADO PARA IMPRESSÃO DE ETIQUETA PATRIMONIAL */}
      <style>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          #bloco-etiqueta-impressao, #bloco-etiqueta-impressao * { visibility: visible; }
          #bloco-etiqueta-impressao { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 60mm; /* Tamanho padrão de etiqueta térmica */
            height: auto;
            padding: 5px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }
          @page { size: auto; margin: 0; }
        }
      `}</style>

      {/* HEADER E BARRA DE BUSCA */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-50 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
               <span className="bg-blue-500 p-2 rounded-xl text-white text-sm">🛠️</span> GESTÃO DE ATIVOS
            </h1>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Inventário patrimonial, controle operacional e prontuários</p>
          </div>
          <button
            onClick={() => { setEditandoId(null); setForm(estadoInicial); setModalAberta(true); }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all text-xs uppercase tracking-wider"
          >
            + Novo Ativo
          </button>
        </div>

        {/* PAINEL DE FILTROS DINÂMICOS COMBINADOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Busca Global</label>
            <input
              type="text"
              placeholder="🔍 Nome, patrimônio, série ou fabricante..."
              className="w-full p-2.5 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all text-xs font-bold bg-slate-50"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Isolar Localização</label>
            <select className="w-full p-2.5 border-2 border-slate-110 rounded-xl outline-none bg-slate-50 font-bold text-xs" value={filtroSetor} onChange={e => setFiltroSetor(e.target.value)}>
              <option value="todos">⭐ Todos os Setores</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Filtrar Status</label>
            <select className="w-full p-2.5 border-2 border-slate-110 rounded-xl outline-none bg-slate-50 font-bold text-xs" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="todos">⭐ Todos os Status</option>
              <option value="Ativo">🟢 Ativo</option>
              <option value="Reserva">🔵 Reserva</option>
              <option value="Em Manutenção">🟡 Em Manutenção</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABELA PRINCIPAL */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <tr>
              <th className="p-5">Equipamento / Setor</th>
              <th className="p-5">Patrimônio / Série</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-center">Identificador QR</th>
              <th className="p-5 text-center">Ações Operacionais</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-xs">
            {equipamentosFiltrados.map(e => (
              <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-5">
                  <div className="font-black text-slate-700 uppercase tracking-tight">{e.nome}</div>
                  <div className="text-[10px] text-blue-600 font-bold uppercase tracking-wide mt-0.5">{e.setor_nome || 'Setor não definido'}</div>
                </td>
                <td className="p-5">
                  <div className="text-[11px] font-mono font-black text-slate-600 bg-slate-100 inline-block px-2 py-0.5 rounded uppercase">{e.patrimonio || 'S/P'}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Série: {e.num_serie || '---'}</div>
                </td>
                <td className="p-5">
                  <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider ${
                    e.status === 'Ativo' ? 'bg-green-50 text-green-600 border border-green-100' :
                    e.status === 'Reserva' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                  }`}>
                    {e.status}
                  </span>
                </td>
                
                <td className="p-5 text-center">
                  <button 
                    onClick={() => { setQrZoomUrl(gerarLinkQRCodeLocal(e.id)); setAtivoSelecionadoQR(e); }}
                    className="inline-block p-1 bg-slate-50 border border-slate-100 rounded-xl hover:scale-105 transition-all shadow-sm"
                    title="Visualizar e Imprimir Etiqueta QR"
                  >
                    <img src={gerarLinkQRCodeLocal(e.id)} alt="QR Thumb" className="w-8 h-8 rounded-lg" />
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
            {equipamentosFiltrados.length === 0 && (
              <tr>
                <td colSpan="5" className="p-10 text-center text-xs font-bold text-slate-400 italic">Nenhum equipamento localizado para os parâmetros informados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO */}
      {modalAberta && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className={`p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center ${editandoId ? 'bg-amber-500' : 'bg-blue-600'}`}>
              <span>{editandoId ? '✏️ Editar Equipamento' : '🆕 Novo Equipamento'}</span>
              <button onClick={() => setModalAberta(false)} className="hover:scale-110 transition-transform">✕</button>
            </div>

            <form onSubmit={salvar} className="p-8 grid grid-cols-2 gap-4 text-dark">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome do Equipamento</label>
                <input type="text" required value={form.nome} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 transition-all font-bold text-xs" onChange={e => setForm({...form, nome: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Modelo</label>
                <input type="text" value={form.modelo || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs" onChange={e => setForm({...form, modelo: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Fabricante</label>
                <input type="text" value={form.fabricante || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs" onChange={e => setForm({...form, fabricante: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Patrimônio</label>
                <input type="text" value={form.patrimonio || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none font-mono text-xs font-bold" onChange={e => setForm({...form, patrimonio: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Série</label>
                <input type="text" value={form.num_serie || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs" onChange={e => setForm({...form, num_serie: e.target.value})} />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Setor Responsável</label>
                <select value={form.setor_id || ''} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-xs" onChange={e => setForm({...form, setor_id: e.target.value})}>
                  <option value="">Selecione o Setor...</option>
                  {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Operacional</label>
                <select value={form.status || 'Ativo'} className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none bg-white font-bold text-xs" onChange={e => setForm({...form, status: e.target.value})}>
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

      {/* MODAL DE EXPANSÃO E IMPRESSÃO DO QR CODE */}
      {qrZoomUrl && ativoSelecionadoQR && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150 border border-slate-100">
            <div className="p-4 bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest flex justify-between items-center">
              <span className="flex items-center gap-2">🔍 Identificador QR</span>
              <button onClick={() => { setQrZoomUrl(null); setAtivoSelecionadoQR(null); }} className="font-bold hover:text-red-200">✕</button>
            </div>
            
            {/* CONTAINER ADAPTADO PARA IMPRESSORA TÉRMICA */}
            <div className="p-6 flex flex-col items-center justify-center bg-white" id="bloco-etiqueta-impressao">
              <span className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">SEC-H ENGENHARIA CLÍNICA</span>
              <img src={qrZoomUrl} alt="QR Code Expandido" className="w-40 h-40 rounded-xl p-1 bg-white border border-slate-100" />
              <p className="mt-2 text-xs font-black text-slate-800 uppercase tracking-tight max-w-full truncate">
                {ativoSelecionadoQR.nome}
              </p>
              <p className="text-[10px] font-mono font-black text-blue-600 mt-0.5">
                PAT: {ativoSelecionadoQR.patrimonio || 'S/P'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button 
                type="button" 
                onClick={() => window.print()} 
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 text-center"
              >
                🖨️ Imprimir Etiqueta
              </button>
              <button 
                type="button" 
                onClick={() => { setQrZoomUrl(null); setAtivoSelecionadoQR(null); }} 
                className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl transition-colors text-center"
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