import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function ImprimirOrcamentoExterno() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  const impressaoDisparada = useRef(false);

  useEffect(() => {
    let nivel = 'admin';
    try {
      const salvo = localStorage.getItem('user');
      if (salvo) {
        const u = JSON.parse(salvo);
        nivel = (u.nivel || u.cargo || u.role || 'admin').toLowerCase().trim();
      }
    } catch (e) {
      console.error(e);
    }

    fetch(`/api/orcamentos-externos/${id}`, {
      headers: {
        'Content-Type': 'application/json',
        'x-usuario-nivel': nivel
      }
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Erro HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setDados(data);
        if (!impressaoDisparada.current) {
          impressaoDisparada.current = true;
          setTimeout(() => {
            window.print();
          }, 450);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar orçamento:', err);
        setErro(err.message);
      });
  }, [id]);

  const handleVoltar = () => {
    if (window.history.length <= 1) {
      window.close();
      navigate('/orcamentos-externos');
    } else {
      navigate(-1);
    }
  };

  const formatarMoeda = (valor) =>
    Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatarData = (valor) =>
    valor ? new Date(valor).toLocaleDateString('pt-BR') : '---';

  if (erro) {
    return (
      <div className="p-8 text-center text-red-600 font-bold">
        Falha ao carregar orçamento: {erro}
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="p-8 text-center font-bold text-slate-500 animate-pulse">
        Carregando espelho do orçamento...
      </div>
    );
  }

  const { orcamento, itens = [] } = dados;
  const estaAprovado = orcamento.status === 'Aprovado Financeiro';

  return (
    <div className="bg-slate-100 min-h-screen p-4 sm:p-6 font-sans">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            height: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden !important;
          }

          #folha-orcamento-impressao,
          #folha-orcamento-impressao * {
            visibility: visible !important;
          }

          #folha-orcamento-impressao {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 18px 22px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            border: 2px solid #000 !important;
            min-height: 275mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Barra de Ações Superior */}
      <div className="max-w-4xl mx-auto mb-4 flex justify-between items-center no-print">
        <button
          type="button"
          onClick={handleVoltar}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 active:scale-95"
        >
          ← Voltar / Fechar
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          <span>🖨️</span> Imprimir / Salvar PDF
        </button>
      </div>

      {/* Folha Principal de Impressão */}
      <div
        id="folha-orcamento-impressao"
        className="max-w-4xl mx-auto bg-white p-7 rounded-2xl shadow-sm border-2 border-black text-slate-900 flex flex-col justify-between"
      >
        <div>
          {/* Cabeçalho */}
          <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-950">
                Hospital Domingos Lourenço
              </h1>
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">
                Engenharia Clínica, Manutenção Predial & Suprimentos
              </p>
            </div>
            <div className="text-right">
              <div className="bg-black text-white px-3 py-0.5 text-xs font-black rounded mb-1 tracking-wider inline-block">
                PARECER DE ORÇAMENTO
              </div>
              <p className="text-base font-black font-mono leading-none">{orcamento.codigo_orcamento}</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                Data: {formatarData(orcamento.data_emissao)}
              </p>
            </div>
          </div>

          {/* Metadados Técnicos */}
          <div className="grid grid-cols-4 gap-3 mb-4 text-xs bg-slate-50 p-3 border border-slate-300 rounded-lg">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Situação:</span>
              <span className={`font-black uppercase text-[11px] ${estaAprovado ? 'text-emerald-700' : 'text-amber-700'}`}>
                {estaAprovado ? '✅ Aprovado' : '⏳ Pendente Validação'}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Tipo de Proposta:</span>
              <span className="font-bold uppercase text-[11px]">{orcamento.tipo_orcamento || 'Misto / Geral'}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Responsável Técnico:</span>
              <span className="font-bold text-[11px]">{orcamento.criado_por_nome || 'Eduardo Nascimento'}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase block">Validação Diretoria:</span>
              <span className="font-bold text-[11px]">{formatarData(orcamento.data_aprovacao)}</span>
            </div>
          </div>

          {/* Box 1: Fornecedor e Destinação */}
          <div className="border border-black rounded-lg overflow-hidden mb-4 text-xs">
            <div className="bg-slate-100 border-b border-black px-3 py-1 font-black uppercase text-[10px] flex justify-between">
              <span>1. Qualificação do Fornecedor & Destinação Hospitalar</span>
              <span className="text-[9px]">Cadastro Homologado</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-x-6 gap-y-1.5 leading-relaxed">
              <p className="col-span-2">
                <strong>Empresa Prestadora:</strong>{' '}
                <span className="font-bold text-slate-900">
                  {orcamento.razao_social || orcamento.fornecedor_nome}
                </span>
                {orcamento.razao_social && orcamento.fornecedor_nome !== orcamento.razao_social && (
                  <span className="text-slate-500 ml-1">({orcamento.fornecedor_nome})</span>
                )}
              </p>
              <p>
                <strong>CNPJ:</strong> {orcamento.cnpj || 'Sob consulta cadastral'}
              </p>
              <p>
                <strong>Contato / Representante:</strong> {orcamento.fornecedor_contato || 'Depto. Comercial'}
              </p>
              <p className="col-span-2">
                <strong>Telefone / E-mail:</strong> {orcamento.telefone || orcamento.email || 'Cadastrado no repositório de fornecedores'}
              </p>
              <p className="col-span-2 border-t border-slate-200 pt-2 mt-0.5">
                <strong>Setor Destino / Obra:</strong>{' '}
                <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block">
                  📍 {orcamento.setor_nome_completo || orcamento.setor_nome || 'Hospital Geral'}
                </span>
              </p>
              {orcamento.observacoes && (
                <p className="col-span-2 text-[11px] text-slate-700 italic bg-amber-50/50 p-1.5 rounded border border-amber-200 mt-1">
                  <strong>Condições Comerciais / Observações:</strong> {orcamento.observacoes}
                </p>
              )}
            </div>
          </div>

          {/* Box 2: Tabela de Itens */}
          <div className="border border-black rounded-lg overflow-hidden mb-4">
            <div className="bg-slate-100 border-b border-black px-3 py-1 font-black uppercase text-[10px] flex justify-between">
              <span>2. Composição e Discriminação dos Serviços / Peças</span>
              <span className="text-[9px] font-bold">{itens.length} Item(ns) no Lote</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[9px] tracking-wider">
                  <th className="p-2 w-10 text-center">Item</th>
                  <th className="p-2 w-16 text-center">Ref. OS</th>
                  <th className="p-2 w-[34%]">Ativo / Localização Específica</th>
                  <th className="p-2">Detalhamento Técnico do Serviço</th>
                  <th className="p-2 text-right w-24">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {itens.map((item, idx) => {
                  const ehOS = Boolean(item.chamado_id);
                  const ehEquipamento = Boolean(
                    item.equipamento_nome &&
                    item.equipamento_nome !== 'Serviço Predial / Infraestrutura' &&
                    item.equipamento_nome !== 'Equipamento'
                  );

                  // Evita duplicar título e descrição se forem praticamente o mesmo texto
                  const tituloLimpo = (item.item_titulo || item.titulo_exibicao || '').trim();
                  const descLimpa = (item.descricao_proposta || '').trim();
                  const descEhDiferente = descLimpa && descLimpa.toLowerCase() !== tituloLimpo.toLowerCase();

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 text-center font-bold font-mono text-slate-400">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="p-2.5 text-center font-black">
                        {ehOS ? (
                          <span className="text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                            #{item.chamado_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-semibold">AVULSO</span>
                        )}
                      </td>
                      <td className="p-2.5 leading-snug">
                        {ehEquipamento ? (
                          <div>
                            <p className="font-bold text-slate-900">{item.equipamento_nome}</p>
                            <p className="text-[10px] text-slate-500">
                              Pat: <strong>{item.patrimonio || 'S/P'}</strong> | S/N: {item.num_serie || 'N/A'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-bold text-slate-900">Infraestrutura Predial</p>
                            <p className="text-[10px] text-slate-600">
                              📍 {item.item_setor_completo || item.setor_nome || orcamento.setor_nome_completo || 'Hospital'}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="p-2.5 leading-snug">
                        <p className="font-bold text-slate-900">{tituloLimpo}</p>
                        {descEhDiferente && (
                          <p className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-wrap">
                            {descLimpa}
                          </p>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatarMoeda(item.valor_unitario)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black border-t-2 border-black text-xs">
                  <td colSpan="4" className="p-3 text-right uppercase text-[10px] tracking-wider">
                    Valor Total Consolidado da Proposta:
                  </td>
                  <td className="p-3 text-right text-sm font-black font-mono text-slate-950 whitespace-nowrap">
                    {formatarMoeda(orcamento.valor_total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Instrução Contábil */}
          <div className="text-[10px] text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-300 leading-relaxed mb-4">
            <p className="font-bold text-slate-800 uppercase text-[9px] mb-0.5">Instrução Contábil & Rateio Financeiro:</p>
            Os valores acima foram negociados em proposta única com a prestadora. Quando houver a emissão da Nota Fiscal no valor total de{' '}
            <strong>{formatarMoeda(orcamento.valor_total)}</strong>, o montante deve ser apropriado no centro de custos do setor{' '}
            <strong>{orcamento.setor_nome_completo || orcamento.setor_nome || 'Manutenção Predial'}</strong> para fins de auditoria, baixa e prestação de contas.
          </div>
        </div>

        {/* Linhas de Assinatura */}
        <div className="grid grid-cols-2 gap-10 text-center pt-4 text-xs border-t-2 border-slate-300">
          <div className="flex flex-col justify-end min-h-[75px]">
            <div className="h-10 border-b border-black mb-1"></div>
            <p className="font-black uppercase text-slate-900">Engenharia Clínica & Manutenção</p>
            <p className="text-[9px] text-slate-500 uppercase font-semibold">Responsável Técnico / Emissor</p>
          </div>
          <div className="flex flex-col justify-end min-h-[75px]">
            <div className="h-10 border-b border-black mb-1 flex items-end justify-center pb-1">
              {estaAprovado && (
                <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded border border-emerald-300">
                  Aprovado Eletronicamente via Sistema
                </span>
              )}
            </div>
            <p className="font-black uppercase text-slate-900">Diretoria / Gestão Financeira</p>
            <p className="text-[9px] text-slate-500 uppercase font-semibold">Validação Orçamentária & Baixa Contábil</p>
          </div>
        </div>
      </div>
    </div>
  );
}