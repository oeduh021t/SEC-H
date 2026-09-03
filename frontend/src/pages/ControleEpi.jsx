import { useEffect, useState, useCallback } from 'react';

export default function ControleEpi() {
  const [fichas, setFichas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  // 🆕 ESTADOS DE FILTROS AVANÇADOS
  const [filtroStatus, setFiltroStatus] = useState('todos'); // 'todos', 'pendente', 'entregue'
  const [filtroNivel, setFiltroNivel] = useState('todos');   // 'todos', 'tecnico', 'usuario', etc.
  const [filtroMotivo, setFiltroMotivo] = useState('todos'); // Novo filtro por motivo de entrega

  // Estados do Modal de Upload
  const [modalAberto, setModalAberto] = useState(false);
  const [usuarioId, setUsuarioId] = useState('');
  const [dataEntrega, setDataEntrega] = useState(new Date().toISOString().split('T')[0]);
  const [motivoEntrega, setMotivoEntrega] = useState('Primeira Entrega'); // 🛠️ NOVO: Motivo NR-6
  const [numeroCa, setNumeroCa] = useState('');                           // 🛠️ NOVO: Controle de C.A.
  const [observacao, setObservacao] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const API_URL = '/api';
  const BASE_URL = '';

  const obterNivelUsuario = () => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser).nivel : '';
  };

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const headers = { 'x-usuario-nivel': obterNivelUsuario() };
      const [resFichas, resUsers] = await Promise.all([
        fetch(`${API_URL}/epis`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/usuarios`, { headers }).then(r => r.json())
      ]);

      setFichas(Array.isArray(resFichas) ? resFichas : []);
      setUsuarios(Array.isArray(resUsers) ? resUsers : []);
    } catch (err) {
      console.error("Erro ao carregar dados de EPI:", err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleAbrirModal = () => {
    setUsuarioId('');
    setDataEntrega(new Date().toISOString().split('T')[0]);
    setMotivoEntrega('Primeira Entrega');
    setNumeroCa('');
    setObservacao('');
    setArquivo(null);
    setModalAberto(true);
  };

  const handleSalvarFicha = async (e) => {
    e.preventDefault();
    if (!usuarioId) {
      alert("Selecione o colaborador.");
      return;
    }

    setEnviando(true);
    const formData = new FormData();
    formData.append('usuario_id', usuarioId);
    formData.append('data_entrega', dataEntrega);
    formData.append('motivo_entrega', motivoEntrega); // Enviando o motivo para o backend
    formData.append('numero_ca', numeroCa);           // Enviando o C.A. para o backend
    formData.append('observacao', observacao);
    if (arquivo) formData.append('termo_pdf', arquivo);

    try {
      const res = await fetch(`${API_URL}/epis`, {
        method: 'POST',
        headers: { 'x-usuario-nivel': obterNivelUsuario() },
        body: formData
      });

      if (res.ok) {
        alert("Entrega de EPI registrada com sucesso! 🥽✅");
        setModalAberto(false);
        carregarDados();
      } else {
        const err = await res.json();
        alert(`Erro: ${err.error || 'Falha ao salvar.'}`);
      }
    } catch (err) {
      alert("Erro ao conectar com o servidor.");
    } finally {
      setEnviando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm("Deseja remover este registro de EPI?")) return;
    try {
      const res = await fetch(`${API_URL}/epis/${id}`, {
        method: 'DELETE',
        headers: { 'x-usuario-nivel': obterNivelUsuario() }
      });
      if (res.ok) {
        carregarDados();
      }
    } catch (err) {
      alert("Erro ao excluir.");
    }
  };

  // 🔍 LÓGICA DE FILTRAGEM MULTICRITÉRIO APRIMORADA
  const listaConsolidada = usuarios.map(u => {
    const ultimaFicha = fichas.find(f => Number(f.usuario_id) === Number(u.id));
    return {
      usuario_id: u.id,
      usuario_nome: u.nome,
      usuario_login: u.login,
      usuario_nivel: u.nivel,
      ficha_id: ultimaFicha?.id,
      data_entrega: ultimaFicha?.data_entrega,
      motivo_entrega: ultimaFicha?.motivo_entrega || 'Primeira Entrega',
      numero_ca: ultimaFicha?.numero_ca || '---',
      observacao: ultimaFicha?.observacao,
      url_termo: ultimaFicha?.url_termo,
      status_entregue: !!ultimaFicha
    };
  });

  const dadosFiltrados = listaConsolidada.filter(item => {
    // 1. Busca textual
    const termo = busca.toLowerCase();
    const matchBusca = item.usuario_nome?.toLowerCase().includes(termo) ||
                       item.usuario_login?.toLowerCase().includes(termo) ||
                       item.observacao?.toLowerCase().includes(termo) ||
                       item.numero_ca?.toLowerCase().includes(termo);

    // 2. Filtro de Status de Entrega
    let matchStatus = true;
    if (filtroStatus === 'entregue') matchStatus = item.status_entregue;
    if (filtroStatus === 'pendente') matchStatus = !item.status_entregue;

    // 3. Filtro de Nível
    let matchNivel = true;
    if (filtroNivel !== 'todos') matchNivel = item.usuario_nivel?.toLowerCase() === filtroNivel.toLowerCase();

    // 4. Filtro de Motivo
    let matchMotivo = true;
    if (filtroMotivo !== 'todos') matchMotivo = item.motivo_entrega === filtroMotivo;

    return matchBusca && matchStatus && matchNivel && matchMotivo;
  });

  // Indicadores
  const totalGeral = usuarios.length;
  const totalEntregues = listaConsolidada.filter(i => i.status_entregue).length;
  const totalPendentes = totalGeral - totalEntregues;

  if (loading) return <div className="p-10 text-center font-bold text-slate-400">Carregando fichas de EPI...</div>;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* 🖨️ CSS PARA IMPRESSÃO EM A4 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
            background: white !important;
          }
          .relatorio-impressao, .relatorio-impressao * {
            visibility: visible !important;
          }
          .relatorio-impressao {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .hide-print {
            display: none !important;
          }
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      {/* HEADER & BOTÃO DE IMPRESSÃO */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hide-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <span className="bg-emerald-500 p-2 rounded-xl text-white text-sm">🥽</span> CONTROLE DE ENTREGAS DE EPI (NR-6)
          </h1>
          <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">
            Gestão de Fichas de Fornecimento, C.A. e Termos de Responsabilidade
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-black shadow-md transition-all text-xs uppercase tracking-wider active:scale-95 flex items-center gap-2"
          >
            🖨️ Imprimir Laudo / Relação
          </button>
          <button
            onClick={handleAbrirModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-emerald-100 transition-all text-xs uppercase active:scale-95"
          >
            + Registrar Entrega
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS MULTICRITÉRIO APRIMORADA (Some na impressão) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6 hide-print">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Buscar Colaborador</label>
          <input
            type="text"
            placeholder="🔍 Nome, login, C.A. ou obs..."
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-emerald-500 text-black"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Status do Termo</label>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-emerald-500 text-slate-700 cursor-pointer"
          >
            <option value="todos">⭐ Todos</option>
            <option value="pendente">🔴 Pendentes (Sem Termo)</option>
            <option value="entregue">🟢 Entregues (Termo OK)</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Motivo da Entrega</label>
          <select
            value={filtroMotivo}
            onChange={e => setFiltroMotivo(e.target.value)}
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-emerald-500 text-slate-700 cursor-pointer"
          >
            <option value="todos">⭐ Todos os Motivos</option>
            <option value="Primeira Entrega">🟢 Primeira Entrega</option>
            <option value="Substituição por Desgaste">🔄 Substituição por Desgaste</option>
            <option value="Danos em Serviço">⚠️ Danos em Serviço</option>
            <option value="Extravio">🚨 Extravio</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Perfil de Acesso</label>
          <select
            value={filtroNivel}
            onChange={e => setFiltroNivel(e.target.value)}
            className="w-full p-2.5 border-2 border-slate-100 rounded-xl text-xs font-bold outline-none bg-slate-50 focus:border-emerald-500 text-slate-700 cursor-pointer"
          >
            <option value="todos">⭐ Todos os Níveis</option>
            <option value="tecnico">🔧 Técnicos</option>
            <option value="coordenador">📋 Coordenadores</option>
            <option value="usuario">👤 Usuários de Setor</option>
            <option value="admin">🛡️ Administradores</option>
          </select>
        </div>
      </div>

      {/* CARDS DE MONITORAMENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 hide-print">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total de Colaboradores</span>
          <span className="text-2xl font-black text-slate-800">{totalGeral} Cadastrados</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Termos Arquivados (OK)</span>
          <span className="text-2xl font-black text-emerald-600">{totalEntregues} Colaboradores</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pendentes de Entrega</span>
          <span className="text-2xl font-black text-amber-600">{totalPendentes} Pendentes</span>
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO IMPRESSO E EM TELA */}
      <div className="relatorio-impressao">

        {/* CABEÇALHO EXCLUSIVO PARA O DOCUMENTO IMPRESSO (AUDITORIA NR-6) */}
        <div className="hidden print:block bg-white p-4 border-b-2 border-slate-900 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-black uppercase text-slate-900">CLÍNICA MATERNO INFANTIL DOMINGOS LOURENÇO</h1>
              <p className="text-xs font-bold text-slate-600 uppercase">Engenharia Clínica & SESMT — Ficha de Controle de Fornecimento de EPI (NR-6)</p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-500">
              <div>Emissão: {new Date().toLocaleDateString('pt-BR')}</div>
              <div>Filtro: {filtroStatus.toUpperCase()} | Motivo: {filtroMotivo.toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* TABELA DE REGISTROS */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden print:border-none print:shadow-none">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 print:text-slate-700">
              <tr>
                <th className="p-4">Colaborador / Login</th>
                <th className="p-4">Perfil</th>
                <th className="p-4">Data / Motivo</th>
                <th className="p-4">C.A. / Descrição dos EPIs</th>
                <th className="p-4 text-center">Status / Termo</th>
                <th className="p-4 text-center hide-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium">
              {dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-xs font-bold text-slate-400 italic">
                    Nenhum colaborador localizado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map(item => (
                  <tr key={item.usuario_id} className="hover:bg-slate-50/50 transition-colors print:text-[11px]">
                    <td className="p-4">
                      <div className="font-black text-slate-800 uppercase">{item.usuario_nome}</div>
                      <div className="text-[10px] font-mono text-slate-400 print:text-slate-600">{item.usuario_login}</div>
                    </td>

                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase print:border print:p-0.5">
                        {item.usuario_nivel}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="font-mono font-bold text-slate-700">
                        {item.data_entrega ? new Date(item.data_entrega).toLocaleDateString('pt-BR') : '---'}
                      </div>
                      <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                        {item.motivo_entrega}
                      </span>
                    </td>

                    <td className="p-4 text-slate-600 max-w-xs">
                      {item.numero_ca !== '---' && (
                        <div className="font-mono font-bold text-[10px] text-slate-500 mb-0.5">C.A.: {item.numero_ca}</div>
                      )}
                      {item.observacao || <span className="text-slate-300 italic print:text-slate-400">Nenhum item registrado</span>}
                    </td>

                    <td className="p-4 text-center">
                      {item.status_entregue ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-1 print:border">
                            ✓ Entregue (OK)
                          </span>
                          {item.url_termo && (
                            <a
                              href={`${BASE_URL}${item.url_termo}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[9px] font-bold text-blue-600 hover:underline uppercase hide-print"
                            >
                              📄 Abrir PDF
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-xl text-[10px] font-black uppercase inline-flex items-center gap-1 print:border">
                          ⚠️ Pendente
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-center hide-print">
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setUsuarioId(item.usuario_id);
                            setDataEntrega(new Date().toISOString().split('T')[0]);
                            setMotivoEntrega('Primeira Entrega');
                            setNumeroCa('');
                            setObservacao('');
                            setArquivo(null);
                            setModalAberto(true);
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-100 rounded-xl font-black text-[10px] uppercase transition-all"
                        >
                          {item.status_entregue ? '🔄 Atualizar' : '📎 Registrar'}
                        </button>
                        {item.ficha_id && (
                          <button
                            onClick={() => handleExcluir(item.ficha_id)}
                            className="p-1.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            title="Remover Ficha"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* RODAPÉ DO DOCUMENTO IMPRESSO */}
        <div className="hidden print:block mt-12 pt-4 border-t border-slate-300 text-center text-[9px] text-slate-500 uppercase font-bold tracking-wider">
          Relatório gerencial emitido para fins de conformidade com a Norma Regulamentadora nº 06 (NR-6) — SESMT / Engenharia Clínica
        </div>

      </div>

      {/* MODAL DE REGISTRO */}
      {modalAberto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 hide-print">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-150">
            <div className="bg-emerald-600 p-5 text-white font-black uppercase text-xs tracking-widest flex justify-between items-center">
              <span>🥽 Registrar Fornecimento de EPI (NR-6)</span>
              <button onClick={() => setModalAberto(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvarFicha} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Colaborador *</label>
                <select
                  required
                  value={usuarioId}
                  onChange={e => setUsuarioId(e.target.value)}
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-black outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione o Colaborador...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nome} ({u.login})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Data da Entrega *</label>
                  <input
                    type="date"
                    required
                    value={dataEntrega}
                    onChange={e => setDataEntrega(e.target.value)}
                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-black outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Motivo da Entrega *</label>
                  <select
                    value={motivoEntrega}
                    onChange={e => setMotivoEntrega(e.target.value)}
                    className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-black outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Primeira Entrega">🟢 Primeira Entrega</option>
                    <option value="Substituição por Desgaste">🔄 Substituição por Desgaste</option>
                    <option value="Danos em Serviço">⚠️ Danos em Serviço</option>
                    <option value="Extravio">🚨 Extravio / Perda</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Número do C.A. (Certificado de Aprovação) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 12345 ou M.T.E. válido"
                  value={numeroCa}
                  onChange={e => setNumeroCa(e.target.value)}
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-bold bg-slate-50 text-black outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Descrição / Relação dos EPIs Entregues *</label>
                <textarea
                  rows={2}
                  required
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  placeholder="Ex: 1x Óculos de Proteção Incolor, 1x Par de Bota de Couro Bico de Aço..."
                  className="w-full p-3 border-2 border-slate-100 rounded-xl text-xs font-medium bg-slate-50 text-black outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Anexar Ficha / Termo Assinado (PDF ou Foto)</label>
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={e => setArquivo(e.target.files[0])}
                  className="w-full p-2 border-2 border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500 bg-slate-50"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAberto(false)}
                  className="flex-1 bg-slate-100 py-3 rounded-xl font-black text-xs uppercase text-slate-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-emerald-100 transition-all"
                >
                  {enviando ? 'Salvando...' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}