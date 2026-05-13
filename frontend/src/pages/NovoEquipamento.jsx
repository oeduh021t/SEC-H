import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NovoEquipamento = () => {
  const navigate = useNavigate();
  const [setores, setSetores] = useState([]);
  const [tipos, setTipos] = useState([]);
  const API_URL = 'http://192.168.5.101:3000/api';

  const [form, setForm] = useState({
    nome: '', modelo: '', patrimonio: '', num_serie: '', fabricante: '',
    setor_id: '', tipo_id: '', status: 'Ativo'
  });

  useEffect(() => {
    // Busca setores
    fetch(`${API_URL}/setores`)
      .then(res => res.json())
      .then(data => setSetores(data))
      .catch(err => console.error("Erro ao carregar setores:", err));

    // Busca tipos (Certifique-se que essa rota existe no seu index.js)
    fetch(`${API_URL}/tipos_equipamentos`)
      .then(res => res.json())
      .then(data => setTipos(data))
      .catch(err => console.error("Erro ao carregar tipos:", err));
  }, []);

  const salvar = (e) => {
    e.preventDefault();
    fetch(`${API_URL}/equipamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    .then(res => {
      if (res.ok) navigate('/equipamentos');
      else alert("Erro ao salvar equipamento");
    })
    .catch(err => console.error("Erro na requisição:", err));
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest leading-none">🆕 Novo Cadastro</h2>
            <p className="text-blue-200 text-[10px] font-black mt-2 uppercase tracking-tighter">Engenharia Clínica / Inventário de Ativos</p>
          </div>
          <button onClick={() => navigate('/equipamentos')} className="text-white/50 hover:text-white transition-colors">✕</button>
        </div>

        <form onSubmit={salvar} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-700">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nome do Equipamento</label>
            <input type="text" required value={form.nome} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-400 transition-all font-bold" placeholder="Ex: Monitor Multiparamétrico" onChange={e => setForm({...form, nome: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patrimônio</label>
            <input type="text" required value={form.patrimonio} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-mono font-bold" placeholder="001234" onChange={e => setForm({...form, patrimonio: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nº de Série</label>
            <input type="text" value={form.num_serie} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400" placeholder="SN998877" onChange={e => setForm({...form, num_serie: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Marca / Fabricante</label>
            <input type="text" value={form.fabricante} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none" onChange={e => setForm({...form, fabricante: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modelo</label>
            <input type="text" value={form.modelo} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none" onChange={e => setForm({...form, modelo: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Setor</label>
            <select required value={form.setor_id} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-sm" onChange={e => setForm({...form, setor_id: e.target.value})}>
              <option value="">Selecione...</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Status Inicial</label>
            <select value={form.status} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-sm" onChange={e => setForm({...form, status: e.target.value})}>
              <option value="Ativo">🟢 Ativo</option>
              <option value="Reserva">🔵 Reserva</option>
              <option value="Em Manutenção">🟡 Em Manutenção</option>
            </select>
          </div>

          <div className="md:col-span-2 pt-6 flex gap-4">
            <button type="button" onClick={() => navigate('/equipamentos')} className="flex-1 bg-slate-100 text-slate-400 py-4 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all tracking-widest">Cancelar</button>
            <button type="submit" className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-tight">Finalizar Cadastro</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NovoEquipamento;
