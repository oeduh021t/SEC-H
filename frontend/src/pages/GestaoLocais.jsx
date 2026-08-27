import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GestaoLocais = () => {
  const navigate = useNavigate();
  const [locais, setLocais] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Estados de Cadastro / Edição
  const [editandoId, setEditandoId] = useState(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');

  const API_URL = 'http://192.168.5.101:3000/api';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarLocais = () => {
    setLoading(true);
    fetch(`${API_URL}/locais-estoque`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': obterNivelUsuario()
      }
    })
      .then(res => res.json())
      .then(data => setLocais(Array.isArray(data) ? data : []))
      .catch(err => console.error("Erro ao buscar locais de estoque:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    carregarLocais();
  }, []);

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) return;

    setSalvando(true);
    const url = editandoId ? `${API_URL}/locais-estoque/${editandoId}` : `${API_URL}/locais-estoque`;
    const method = editandoId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-usuario-nivel': obterNivelUsuario()
        },
        body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim() })
      });

      if (res.ok) {
        alert(editandoId ? "Escopo atualizado com sucesso! ✏️" : "Novo local de estoque criado! 🏢✨");
        limparFormulario();
        carregarLocais();
      } else {
        alert("Erro ao salvar o local de estoque. Verifique suas permissões.");
      }
    } catch (err) {
      alert("Erro de conexão ao salvar local.");
    } finally {
      setSalvando(false);
    }
  };

  const handleIniciarEdicao = (local) => {
    setEditandoId(local.id);
    setNome(local.nome || '');
    setDescricao(local.descricao || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const limparFormulario = () => {
    setEditandoId(null);
    setNome('');
    setDescricao('');
  };

  const handleVerBalanco = (localId) => {
    navigate(`/relatorios/estoque-local?local_estoque_id=${localId}`);
  };

  const locaisFiltrados = locais.filter(l =>
    l.nome?.toLowerCase().includes(busca.toLowerCase().trim()) ||
    l.descricao?.toLowerCase().includes(busca.toLowerCase().trim())
  );

  if (loading) return (
    <div className="p-12 text-center font-bold text-slate-400 uppercase text-xs tracking-widest animate-pulse">
      Carregando escopos e almoxarifados...
    </div>
  );

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* CABEÇALHO */}
      <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-blue-500 p-2 rounded-xl text-white text-xs">🏢</span> ESCOPOS E LOCAIS DE ESTOQUE
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Almoxarifados físicos, setores de suprimentos e centros de custo
          </p>
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar escopo ou local..."
          className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-72 focus:border-blue-500 transition-colors text-slate-800"
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* CARDS DE STATUS (KPIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escopos Ativos</span>
          <p className="text-xl font-black text-slate-800 mt-1">{locais.length} Almoxarifados Físicos</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrados na Busca</span>
          <p className="text-xl font-black text-blue-600 mt-1">{locaisFiltrados.length} Registros</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORMULÁRIO DE CADASTRO/EDIÇÃO */}
        <div className="lg:col-span-4">
          <form onSubmit={handleSalvar} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>{editandoId ? "✏️" : "➕"}</span>
                {editandoId ? "Editar Local de Estoque" : "Novo Escopo / Almoxarifado"}
              </h3>
              {editandoId && (
                <button type="button" onClick={limparFormulario} className="text-[10px] text-red-500 font-bold uppercase hover:underline">
                  Cancelar
                </button>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
                Nome do Escopo / Local *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Engenharia Clínica, Manutenção, TI..."
                value={nome}
                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none focus:bg-white focus:border-blue-500 transition-all font-bold text-xs bg-slate-50 text-slate-800"
                onChange={e => setNome(e.target.value)}
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
                Descrição / Finalidade
              </label>
              <textarea
                rows={3}
                placeholder="Descreva brevemente a finalidade ou área atendida por este estoque..."
                value={descricao}
                className="w-full p-3 border-2 border-slate-100 rounded-xl outline-none text-xs font-medium bg-slate-50 text-slate-800 resize-none focus:bg-white focus:border-blue-500"
                onChange={e => setDescricao(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={salvando || !nome.trim()}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {salvando ? "Gravando..." : editandoId ? "💾 Atualizar Local" : "💾 Cadastrar Escopo"}
            </button>
          </form>
        </div>

        {/* TABELA DE VISUALIZAÇÃO */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Locais Registrados
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {locaisFiltrados.length} Registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-3.5">Nome do Escopo / Local</th>
                  <th className="p-3.5">Descrição / Finalidade</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {locaisFiltrados.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5">
                      <div className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                        <span className="text-blue-500">📍</span> {l.nome}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">ID: #{l.id}</span>
                    </td>

                    <td className="p-3.5 text-slate-600 font-medium">
                      {l.descricao || 'Nenhuma descrição informada.'}
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700">
                        ● {l.status || 'Ativo'}
                      </span>
                    </td>

                    <td className="p-3.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleVerBalanco(l.id)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-blue-100 shadow-sm"
                          title="Ver Balanço Consolidado deste Estoque"
                        >
                          📊 Balanço
                        </button>
                        <button
                          type="button"
                          onClick={() => handleIniciarEdicao(l)}
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition-all"
                          title="Editar Escopo"
                        >
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {locaisFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-10 text-xs font-bold text-slate-400 italic">
                      Nenhum local de estoque localizado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default GestaoLocais;