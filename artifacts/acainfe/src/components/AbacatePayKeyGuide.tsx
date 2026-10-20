import * as React from "react";
import "./abacatepay-key-guide.css";

export function AbacatePayKeyGuide() {
  return (
    <section
      className="abacatepay-key-guide"
      aria-labelledby="abacatepay-key-guide-title"
    >
      <h3 id="abacatepay-key-guide-title">
        Como criar sua chave no AbacatePay
      </h3>
      <p>
        Abra o painel do AbacatePay e a tela <strong>Nova chave de API</strong>.
        Configure assim:
      </p>
      <ol>
        <li>
          <strong>Versão da API</strong>
          <span>
            Selecione <b>API v2</b>, marcada como “Recomendada”.
          </span>
        </li>
        <li>
          <strong>Escopo</strong>
          <span>
            Escolha <b>Personalizado</b>.
          </span>
        </li>
        <li>
          <strong>Permissões</strong>
          <span>
            Marque <b>PRODUCT:READ</b> (Ver produtos), <b>WEBHOOK:CREATE</b>{" "}
            (Criar webhooks), <b>CHECKOUT:READ</b> (Ver checkouts),{" "}
            <b>TRANSPARENT:READ</b> (Ver cobranças transparentes),{" "}
            <b>SUBSCRIPTION:READ</b> (Ver assinaturas) <b>CUSTOMER:READ</b> (Ver
            dados dos clientes). As quatro últimas permitem ler as vendas
            passadas e os dados dos clientes.
          </span>
        </li>
        <li>
          <strong>Descrição</strong>
          <span>
            Digite <b>acainfe</b> para identificar esta conexão.
          </span>
        </li>
        <li>
          <strong>Continue no AbacatePay</strong>
          <span>
            Clique em <b>Continuar</b> e conclua a criação da chave. Depois,
            copie a chave gerada e cole no campo abaixo.
          </span>
        </li>
      </ol>
      <p className="abacatepay-key-guide-note">
        Cole a chave somente no campo protegido abaixo. Não envie por mensagem
        nem compartilhe capturas com a chave visível.
      </p>
    </section>
  );
}
