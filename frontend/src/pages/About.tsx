import React from 'react';

export default function AboutTerms() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-4xl font-bold text-[#003c6c]">
        About & Terms of Use
      </h1>

      <p className="mb-8 text-sm text-slate-950">
        Learn about the origins of SlugSmart, the goals of the project,
        acknowledgements, and important information regarding the intended
        use of the platform.
      </p>

      {/* ABOUT */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">
          About the Project
        </h2>

        <p className="mb-4 text-sm text-slate-950">
          <strong>SlugSmart</strong> (originally <em>UCSC Financial Purchase
          Prediction</em>) is a senior capstone project developed for
          CSE 115B/115C at the University of California, Santa Cruz by Shivani
          Belambe, Serena Choi, Joe Hargon, Edwin Huang, and Eunice Shen.
        </p>

        <p className="mb-4 text-sm text-slate-950">
          The project was proposed by the UCSC Financial Affairs Office to 
          address a growing challenge facing the Bay Tree Campus Store. Over time, 
          university departments have increasingly shifted purchasing activity 
          toward external vendors such as Amazon and other procurement channels. 
          As a result, campus store sales have declined, and the 2025 relocation of 
          the bookstore presents additional concerns regarding reduced visibility and 
          foot traffic.
        </p>

        <p className="mb-4 text-sm text-slate-950">
          In addition, bookstore stocking decisions have historically relied on 
          internal sales reports and manual analysis. While these reports provide 
          insight into what is currently selling, they do not capture purchasing 
          activity occurring through external procurement systems. As a result, 
          decision-makers have limited visibility into the full university purchasing 
          ecosystem and may miss opportunities to stock products that departments 
          are already buying elsewhere.
        </p>

        <p className="mb-4 text-sm text-slate-950">
          SlugSmart was created to bridge this information gap. By aggregating and 
          analyzing purchasing data from multiple procurement channels (Amazon Business, 
          CruzBuy, OneCard, and Bay Tree Bookstore sales), SlugSmart provides a unified 
          view of campus purchasing activity for tangible goods. The platform combines 
          transaction analytics, reporting tools, and AI-powered forecasting models to 
          identify purchasing trends, highlight high-impact products, and uncover 
          opportunities for strategic inventory planning.
        </p>

        <p className="mb-4 text-sm text-slate-950">
          The primary goal of SlugSmart is to help the UCSC Financial Affairs Office 
          make more informed stocking decisions by understanding what departments are 
          purchasing both internally and externally. By identifying products with strong 
          external demand, the university can potentially redirect spending back toward 
          campus-operated services, improve convenience for university employees, and 
          strengthen support for campus resources.
        </p>

        <p className="text-sm text-slate-950">
          Beyond financial benefits, the project also aligns with broader sustainability 
          goals. Increasing local availability of commonly purchased items may reduce 
          reliance on individual deliveries, helping decrease packaging waste, delivery 
          traffic, and the environmental impact associated with external procurement.
        </p>
      </section>

      {/* ACKNOWLEDGEMENTS */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">
          Acknowledgements
        </h2>

        <p className="mb-6 text-sm text-slate-950">
          Special thanks to everyone who contributed to the success of
          this project.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-2 text-lg font-semibold text-[#003c6c]">
              Project Sponsors
            </h3>

            <ul className="list-disc pl-6 text-sm text-slate-950">
              <li>Douglas Lang</li>
              <li>Nicholas Jellison</li>
              <li>Gregg Edgar</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <h3 className="mb-2 text-lg font-semibold text-[#003c6c]">
              CSE 115B/C Team
            </h3>

            <ul className="list-disc pl-6 text-sm text-slate-950">
              <li>Richard Jullig</li>
              <li>Mathis Aubert</li>
              <li>Diego Ortiz Barbosa</li>
            </ul>
          </div>
        </div>
      </section>

      {/* TERMS */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">
          Terms of Use
        </h2>

        <div className="space-y-8">

          <div>
            <h3 className="mb-2 text-xl font-semibold text-[#003c6c]">
              1. Intended Use
            </h3>

            <p className="text-sm text-slate-950">
              SlugSmart is designed to help members of the Financial Affairs 
              Office understand where the most external spending is concentrated 
              and which Bookstore items are highest in demand in order to make 
              more informed Bookstore stocking decisions. 
            </p>

            <p className="mt-3 text-sm text-slate-950">
              The platform is intended to support human decision-making and
              professional judgement rather than replace it.
            </p>

            <p className="mt-3 text-sm text-slate-950">
              SlugSmart is not a comprehensive financial analysis system.
              The platform focuses on item-oriented transactions and may
              exclude services, fees, bills, and other non-item expenditures
              during the data cleaning process. Consequently, analytics
              generated by SlugSmart reflect the cleaned datasets used by
              the platform and should not be treated as a complete record of
              university financial activity.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xl font-semibold text-[#003c6c]">
              2. Data Responsibility
            </h3>

            <p className="text-sm text-slate-950">
              Users are responsible for ensuring that uploaded datasets are
              accurate, up-to-date, properly formatted, and appropriately
              authorized for use.
            </p>

            <p className="mt-3 text-sm text-slate-950">
              Analytics, forecasts, and recommendations generated by
              SlugSmart depend on the quality of the underlying data.
            </p>

            <p className="mt-3 text-sm text-slate-950">
              Users should ensure that platform access and procurement
              datasets are shared only among trusted and authorized parties
              and are handled in accordance with applicable university data
              management practices.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xl font-semibold text-[#003c6c]">
              3. AI & Forecasting Behavior
            </h3>

            <p className="text-sm text-slate-950">
              Forecasts, recommendations, and AI-generated analyses are
              estimates derived from historical data and machine learning
              models. Future purchasing behavior cannot be guaranteed.
            </p>

            <p className="mt-3 text-sm text-slate-950">
              Users should evaluate recommendations alongside their own
              professional expertise.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xl font-semibold text-[#003c6c]">
              4. Academic Project Notice
            </h3>

            <p className="text-sm text-slate-950">
              SlugSmart was developed as a senior capstone project at the
              University of California, Santa Cruz. While every effort has
              been made to ensure reliability and usability, the software is
              provided as-is and may contain limitations, defects, or
              incomplete functionality.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xl font-semibold text-[#003c6c]">
              5. Limitation of Liability
            </h3>

            <p className="text-sm text-slate-950">
              The developers of SlugSmart and the University of California,
              Santa Cruz are not responsible for purchasing decisions,
              financial outcomes, inventory decisions, or operational actions
              taken based on information provided by the platform.
            </p>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Last Updated: May 31, 2026
        </p>
      </section>
    </div>
  );
}