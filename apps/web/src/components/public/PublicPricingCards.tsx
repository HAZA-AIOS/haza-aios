import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faArrowRight } from "@fortawesome/free-solid-svg-icons";

const plans = [
  {
    name: "Starter",
    price: 15,
    summary: "A starting point for small teams.",
    features: ["Organization workspace", "Core platform evaluation", "Agent builder foundation"],
  },
  {
    name: "Professional",
    price: 40,
    summary: "For growing operational teams.",
    features: [
      "Education SIS evaluation",
      "Academic and administrative modules",
      "Reporting and portal capabilities",
    ],
  },
  {
    name: "Enterprise",
    price: 90,
    summary: "For broader organizational requirements.",
    features: [
      "Organization-wide scope review",
      "Role and access planning",
      "Integration and rollout assessment",
    ],
  },
] as const;

export function PublicPricingCards() {
  return (
    <div className="public-pricing-grid">
      {plans.map((plan) => (
        <article className="public-price-card" key={plan.name} aria-label={`${plan.name} plan`}>
          <p className="price-kicker">{plan.name}</p>
          <h3>{plan.summary}</h3>
          <p className="price-amount">
            <span>${plan.price}</span>
            <span>USD / month</span>
          </p>
          <p className="price-status">Indicative pricing</p>
          <ul>
            {plan.features.map((feature) => (
              <li key={feature}>
                <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <a className="public-button" href="/register">
            Evaluate {plan.name}
            <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
  );
}
