import { useEffect, useState } from "react";

export function TiposEquipamentos() {
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [nomeNovoTipo, setNomeNovoTipo] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 12;

  const API_URL = "/api";

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser).nivel : "";
  };

  const carregarTipos = async () => {
    try {
      const res = await fetch(`${API_URL}/tipos-equipamentos`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-usuario-nivel": obterNivelUsuario()
        }
      }).then((res) => res.json());
      setTipos(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Erro ao carregar tipos de equipamentos:", err);
      setTipos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTipos();
  }, []);

  const handleCadastrar = async (e) => {
    e.preventDefault();
    if (!nomeNovoTipo.trim()) return;

    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/tipos-equipamentos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-usuario-nivel": obterNivelUsuario()
        },
        body: JSON.stringify({ nome: nomeNovoTipo.trim() })
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Família/Tipo cadastrado com sucesso!");
        setNomeNovoTipo("");
        carregarTipos();
      } else {
        alert("❌ " + (data.error || "Erro ao cadastrar tipo."));
      }
    } catch (err) {
      alert("❌ Erro de conexão com o servidor.");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id, nome) => {
    if (!window.confirm(`⚠️ Deseja realmente excluir a categoria "${nome}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/tipos-equipamentos/${id}`, {
        method: "DELETE",
        headers: {
          "x-usuario-nivel": obterNivelUsuario()
        }
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Categoria removida com sucesso!");
        carregarTipos();
      } else {
        alert("❌ " + (data.error || "Não foi possível excluir o tipo."));
      }
    } catch (err) {
      alert("❌ Erro de conexão ao excluir.");
    }
  };

  const tiposFiltrados = tipos.filter((t) =>
    t.nome?.toLowerCase().includes(busca.toLowerCase().trim())
  );

  const totalPaginas = Math.ceil(tiposFiltrados.length / itensPorPagina) || 1;
  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const tiposPaginados = tiposFiltrados.slice(indexInicio, indexInicio + itensPorPagina);

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse">
        Carregando famílias e tipos de ativos...
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* CABEÇALHO */}
      <div className="mb-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-indigo-500 p-2 rounded-xl text-white text-xs">🏷️</span> FAMÍLIAS & TIPOS DE ATIVOS
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Padronização de categorias, aparelhos e escopos técnicos
          </p>
        </div>

        <input
          type="text"
          placeholder="🔍 Buscar tipo ou família..."
          className="p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 w-full sm:w-72 focus:border-indigo-500 transition-colors"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPaginaAtual(1);
          }}
        />
      </div>

      {/* KPI / CARD DE STATUS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Categorias</span>
          <p className="text-xl font-black text-slate-800 mt-1">{tipos.length} Tipos Cadastrados</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrados na Busca</span>
          <p className="text-xl font-black text-indigo-600 mt-1">{tiposFiltrados.length} Registros</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORMULÁRIO DE CADASTRO */}
        <div className="lg:col-span-4">
          <form onSubmit={handleCadastrar} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
              <span>➕</span> Novo Tipo de Equipamento
            </h3>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">
                Nome da Categoria / Família *
              </label>
              <input
                required
                type="text"
                placeholder="Ex: Cardioversor, Compressor, Autoclave..."
                className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-indigo-500 text-slate-800"
                value={nomeNovoTipo}
                onChange={(e) => setNomeNovoTipo(e.target.value)}
              />
              <p className="text-[9px] font-bold text-slate-400 mt-1.5 leading-tight px-1">
                Essa categoria ficará disponível em todos os formulários e filtros de ativos.
              </p>
            </div>

            <button
              type="submit"
              disabled={salvando || !nomeNovoTipo.trim()}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md shadow-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {salvando ? "Cadastrando..." : "💾 Cadastrar Tipo"}
            </button>
          </form>
        </div>

        {/* TABELA DE LISTAGEM */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Categorias Registradas
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {tiposFiltrados.length} Tipos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="p-3">ID</th>
                  <th className="p-3">Nome da Família / Tipo</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {tiposPaginados.map((tipo) => (
                  <tr key={tipo.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 font-mono text-slate-400 font-bold">#{tipo.id}</td>
                    <td className="p-3.5">
                      <span className="font-black text-slate-700 uppercase tracking-tight">
                        {tipo.nome}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleExcluir(tipo.id, tipo.nome)}
                        className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all border border-red-100 active:scale-95 shadow-sm"
                        title="Excluir este tipo"
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))}

                {tiposFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="3" className="text-center py-8 text-xs font-bold text-slate-400 italic">
                      Nenhum tipo de equipamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINAÇÃO */}
          {tiposFiltrados.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400">
                Página <strong>{paginaAtual}</strong> de <strong>{totalPaginas}</strong>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaAtual === 1}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default TiposEquipamentos;