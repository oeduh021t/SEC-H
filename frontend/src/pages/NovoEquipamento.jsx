import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const NovoEquipamento = () => {
  const navigate = useNavigate();
  const [setores, setSetores] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [locaisEstoque, setLocaisEstoque] = useState([]); // 🆕 Estado para carregar locais de estoque dinâmicos
  const [fotoEquipamento, setFotoEquipamento] = useState(null);
  const API_URL = 'http://192.168.5.101:3000/api';

  const [form, setForm] = useState({
    nome: '', modelo: '', patrimonio: '', num_serie: '', fabricante: '',
    setor_id: '', tipo_id: '', local_estoque_id: '', status: 'Ativo', periodicidade_preventiva: 0 // 🆕 local_estoque_id adicionado
  });

  // 🔑 AUXILIAR: Captura dinamicamente o privilégio operacional do operador logado
  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  useEffect(() => {
    const headersComNivel = {
      'Content-Type': 'application/json',
      'x-usuario-nivel': obterNivelUsuario() // 🔑 Injetado cabeçalho de privilégios nas buscas iniciais
    };

    fetch(`${API_URL}/setores`, { headers: headersComNivel })
      .then(res => res.json())
      .then(data => setSetores(data || []))
      .catch(err => console.error("Erro ao carregar setores:", err));

    fetch(`${API_URL}/types_equipamentos`, { headers: headersComNivel })
      .then(res => res.json())
      .then(data => setTipos(data || []))
      .catch(err => console.error("Erro ao carregar tipos:", err));

    fetch(`${API_URL}/locais-estoque`, { headers: headersComNivel }) // 🆕 Requisição para popular o select de escopos
      .then(res => res.json())
      .then(data => setLocaisEstoque(data || []))
      .catch(err => console.error("Erro ao carregar locais de estoque:", err));
  }, []);

  const salvar = (e) => {
    e.preventDefault();

    // Converte para FormData para suportar a foto e bater com o esperado no backend
    const formData = new FormData();
    formData.append('nome', form.nome || '');
    formData.append('modelo', form.modelo || '');
    formData.append('patrimonio', form.patrimonio || '');
    formData.append('num_serie', form.num_serie || '');
    formData.append('fabricante', form.fabricante || '');
    formData.append('setor_id', form.setor_id || '');
    formData.append('status', form.status || 'Ativo');
    formData.append('tipo_id', form.tipo_id || '');
    formData.append('periodicidade_preventiva', form.periodicidade_preventiva ? Number(form.periodicidade_preventiva) : 0);
    formData.append('local_estoque_id', form.local_estoque_id || ''); // 🆕 Append do local_estoque_id enviado via multipart/form-data

    if (fotoEquipamento) {
      formData.append('foto_equipamento', fotoEquipamento);
    }

    fetch(`${API_URL}/equipamentos`, {
      method: 'POST',
      headers: {
        // 🔥 IMPORTANTE: Para objetos FormData, passamos apenas o nível de privilégio.
        'x-usuario-nivel': obterNivelUsuario()
      },
      body: formData
    })
    .then(res => {
      if (res.ok) navigate('/equipamentos');
      else alert("Erro ao salvar equipamento. Verifique seus privilégios.");
    })
    .catch(err => console.error("Erro na requisição:", err));
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest leading-none">🆕 Novo Cadastro Padronizado</h2>
            <p className="text-blue-200 text-[10px] font-black mt-2 uppercase tracking-tighter">Engenharia Clínica / Inventário de Ativos</p>
          </div>
          <button onClick={() => navigate('/equipamentos')} className="text-white/50 hover:text-white transition-colors">✕</button>
        </div>

        <form onSubmit={salvar} className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-slate-700">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nome do Equipamento</label>
            <input type="text" required value={form.nome} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-400 transition-all font-bold text-black" placeholder="Ex: Monitor Multiparamétrico" onChange={e => setForm({...form, nome: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Patrimônio</label>
            <input type="text" value={form.patrimonio} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-mono font-bold text-black" placeholder="001234" onChange={e => setForm({...form, patrimonio: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nº de Série</label>
            <input type="text" value={form.num_serie} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 text-black" placeholder="SN998877" onChange={e => setForm({...form, num_serie: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Marca / Fabricante</label>
            <input type="text" value={form.fabricante} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none text-black" placeholder="Ex: GE, Philips" onChange={e => setForm({...form, fabricante: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Modelo</label>
            <input type="text" value={form.modelo} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none text-black" placeholder="Ex: Dash 4000" onChange={e => setForm({...form, modelo: e.target.value})} />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Setor Responsável</label>
            <select required value={form.setor_id} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-sm text-slate-700" onChange={e => setForm({...form, setor_id: e.target.value})}>
              <option value="">Selecione...</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Tipo / Família do Equipamento</label>
            <select required value={form.tipo_id} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-sm text-slate-700" onChange={e => setForm({...form, tipo_id: e.target.value})}>
              <option value="">Selecione...</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>

          {/* 🆕 INSERIDO COM PRECISÃO: Select dinâmico de Escopo / Local de Estoque */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Escopo / Gestão de Estoque *</label>
            <select required value={form.local_estoque_id} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-sm text-slate-700" onChange={e => setForm({...form, local_estoque_id: e.target.value})}>
              <option value="">Selecione o Escopo...</option>
              {locaisEstoque.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Status Inicial</label>
            <select value={form.status} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-sm text-slate-700" onChange={e => setForm({...form, status: e.target.value})}>
              <option value="Ativo">🟢 Ativo</option>
              <option value="Reserva">🔵 Reserva</option>
              <option value="Em Manutenção">🟡 Em Manutenção</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Periodicidade Preventiva (Dias)</label>
            <input type="number" min="0" value={form.periodicidade_preventiva} className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-xs text-black" placeholder="Ex: 180" onChange={e => setForm({...form, periodicidade_preventiva: e.target.value})} />
          </div>

          <div className="md:col-span-2 bg-slate-50 p-4 border-2 border-dashed border-slate-200 rounded-2xl">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Foto do Ativo (Opcional)</label>
            <input 
              type="file" 
              accept="image/*" 
              className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-slate-800 file:text-white hover:file:bg-slate-900 file:cursor-pointer"
              onChange={(e) => setFotoEquipamento(e.target.files[0])} 
            />
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