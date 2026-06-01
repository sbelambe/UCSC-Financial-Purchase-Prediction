import React from 'react';

export default function Help() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-4xl font-bold text-[#003c6c]">Help</h1>

      <p className="mb-8 text-sm text-slate-950">
        If you are a procurement analyst who has recently logged in and are unsure 
        where to begin, this page provides an overview of the recommended SlugSmart 
        workflow.
      </p>

      {/* STEP 1 */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">1. UPLOAD</h2>

        <p className="mb-6 text-sm text-slate-950">
          Place the most recent raw Amazon, CruzBuy, OneCard, and Bookstore datasets
          in the sponsor Google Drive folder.
        </p>

        <h3 className="text-lg font-semibold mb-4 text-[#003c6c]">
          Requirements
        </h3>

        <ul className="mb-6 list-disc space-y-2 pl-6 text-sm text-slate-950">
          <li>
            <strong>.xlsx files.</strong> The pipeline will automatically convert
            the files to .csv format.
          </li>

          <li>
            Naming conventions consistent with the 2025/2026 datasets (i.e., 2025,
            not 25 for the year)
          </li>

          <li>
            <strong>Examples:</strong>
            <ul className="mt-2 list-disc pl-6">
              <li>Amazon Spend Data Calendar 2025.xlsx</li>
              <li>CruzBuy 2025 Tangible Goods.xlsx</li>
              <li>OneCard Data_Jan_Dec 2025.xlsx</li>
              <li>Bay Tree Campus Store Transactions 2025.xlsx</li>
            </ul>
          </li>

          <li>
            Column naming conventions consistent with the 2025/2026 datasets.
            SlugSmart was developed using the 2025 dataset structure and so its
            cleaning pipeline works most effectively with similarly structured
            datasets. Minor differences may process successfully, but significant
            schema changes may require updates to the cleaning pipeline (i.e., if a
            new column is added that should not be displayed in the cleaned
            datasets, it will likely not be removed in the cleaned dataset since it
            will not be in the unnecessary columns list).
          </li>

          <li>
            One file per dataset. Currently, SlugSmart cannot work with multiple
            sets of data per source.
          </li>
        </ul>

        <p className="text-sm text-slate-950">
          Following these requirements will ensure you have the easiest experience
          uploading new procurement data.
        </p>

        <p className="mt-4 text-sm text-slate-950">
          Once the files have been uploaded, press the "Refresh Data" button at the top of 
          the page to begin the data pipeline.
        </p>
      </section>

      {/* STEP 2 */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">
          2. WAIT. CLEANING + STORAGE + RETRAINING
        </h2>

        <p className="mb-6 text-sm text-slate-950">
          Sit back while SlugSmart fetches the datasets. SlugSmart's data pipeline
          automatically detects new files, cleans and standardizes the data,
          updates database storage, and retrains forecasting models when
          applicable. <br /><br />
          Processing may take several minutes depending on dataset size. 
          Once complete, all dashboards, analytics, and forecasts will automatically 
          reflect the newest information.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-[#003c6c]">
          Data Cleaning
        </h3>

        <p className="mb-4 text-sm text-slate-950">
          The data cleaning scripts format each dataset around a consistent schema
          with columns relating to SlugSmart's purpose: Transaction Date, Item Name,
          Item Description, Category, Subcategory, Subtotal, Sales Tax, Total
          Price, Quantity, Merchant Name, Merchant State, Merchant City,
          Transaction Type, and Merchant Type. The cleaned datasets may not have all 
          of these columns due to the different formats of the raw datasets.
          This schema mostly helps to determine which columns to keep or remove.

        </p>

          <p className="mb-4 text-sm font-bold text-slate-950">
            The cleaning pipeline does the following:
          </p>

          <ul className="list-disc space-y-1 pl-6 text-sm text-slate-950">
            <li>Removes sparse and unnecessary columns</li>
            <li>Normalizes missing values to NaN</li>
            <li>Renames column names to match schema names</li>
            <li>Adds new, appropriate columns (Transaction Type, Merchant Type)</li>
            <li>Cleans and standardizes column names</li>
            <li>Removes non-items (CruzBuy, OneCard)</li>
            <li>Removes rows where Total Price or Subtotal are $0.00</li>
            <li>Removes rows where Quantity is 0</li>
            <li>Removes rows with no Item Description</li>
            <li>Normalizes Merchant Name values (Amazon, OneCard)</li>
            <li>Normalizes Merchant State values (Amazon, OneCard)</li>
            <li>Sorts rows by Transaction Date</li>
            <li>Standardizes column values and formatting</li>
          </ul>

          <p className="mt-4 mb-4 text-sm text-slate-950">
            Since SlugSmart is built to work with tangible goods only and many rows
            are removed from the datasets during the cleaning process, SlugSmart is
            not a reflection of overall UCSC spending/sales data and should not be
            used for such.
          </p>

        <h3 className="text-lg font-semibold mb-2 text-[#003c6c]">Storage</h3>

        <p className="mb-6 text-sm text-slate-950">
          The cleaned data is uploaded to the Firestore database. SlugSmart pulls
          from the most recent data upload.
        </p>

        <h3 className="text-lg font-semibold mb-2 text-[#003c6c]">
          ML Retraining
        </h3>

        <p className="text-sm text-slate-950">
          Pressing the "Refresh Data" button activates retraining
          of the ML model. This ensures predictions and insights are based on the
          most up-to-date data.
        </p>
      </section>

      {/* STEP 3 */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">3. USE</h2>

        <p className="mb-4 text-sm text-slate-950">
          Explore purchase/sales activity, identify spending trends, forecast
          future purchases, monitor inventory-related insights, and more.
        </p>

        <h3 className="text-2xl font-semibold mb-2 text- text-[#003c6c]">WHERE</h3>

        <p className="mb-4 text-sm text-slate-950 italic">Where can I find X?</p>

        <h4 className="mb-2 text-lg font-semibold text-[#003c6c]">Sitemap</h4>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm font-bold text-slate-950">
              Home Dashboard: High-level summary of recent purchase/sales trends and
              recommendations
            </p>

            <ul className="list-disc pl-6 text-sm text-slate-950">
              <li>Key Metrics</li>
              <li>Amazon Demand Insights</li>
              <li>Purchase Plan</li>
              <li>Top Items Across Datasets</li>
              <li>Top Vendors</li>
              <li>Transaction Analytics</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm font-bold text-slate-950">
              Dataset Pages: Detailed analysis and insights for an individual dataset
            </p>

            <ul className="list-disc pl-6 text-sm text-slate-950">
              <li>BigQuery Top Items</li>
              <li>Transaction Analytics</li>
              <li>Amazon Demand Insights / Inventory Insights</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm text-slate-950">
              Dataset Explorer: Search, filter, inspect, and export cleaned transaction data
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm text-slate-950">
              Reports: Generate exportable summary reports for analysis, meetings, and 
              presentations
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-950">
          Each component also has an info description in its card so you understand
          what it is and its purpose.
        </p>

        <h3 className="mt-8 text-2xl font-semibold mb-2 text-[#003c6c]">HOW</h3>

        <p className="mb-4 text-sm text-slate-950 italic">How do I do X?</p>

        <div className="space-y-4">
          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              I just uploaded new data. How do I verify everything processed
              correctly?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Key Metrics, Top Items Across Datasets,
              Top External Vendors, Dataset Explorer</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              Check that Key Metrics reflect expected transaction counts and spending 
              totals. Review Top Items Across Datasets and Top External Vendors to 
              confirm newly uploaded purchases appear. Use the Dataset Explorer to inspect 
              the cleaned data directly.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              Where is UCSC spending the most money?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Top Items Across Datasets, Top External Vendors,  
                BigQuery Top Items, Top Transaction Patterns, Total Spend Over Time</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              These help identify the largest spending areas for future procurement plans. 
              Top Items Across Datasets and Top External Vendors list overall leading items, 
              merchants, and categories. Top Transaction Patterns and BigQuery Top Items lists 
              leading attributes for a specific dataset. Use Total Spend Over Time to analyze 
              month-to-month spending trends.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              What frequent external purchases could be stocked in the campus Bookstore?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Amazon Demand Insights, Bookstore Inventory Insights, 
              Top Items Across Datasets (or others, see previous question), Purchase Plan</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              These help use external procurement activity to drive bookstore stocking 
              decisions and reduce off-campus purchasing. Review forecasted demand from 
              Amazon Demand Insights. Compare external purchasing patterns against Bookstore 
              sales activity. Identify products with strong external demand but limited 
              bookstore availability. Add promising items to a Purchase Plan. Export the 
              plan for procurement review.
            </p>
          </div>

                    <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              What should we stock next quarter?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Amazon Demand Insights, Bookstore Inventory Insights, 
                Purchase Plan, BigQuery Top Items</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              These provide seasonal stocking recommendations before upcoming purchasing cycles. 
              Review forecast recommendations. Open individual insight cards for AI-generated 
              analysis. Evaluate projected demand, certainty scores, and inventory status. Add 
              selected products to a Purchase Plan and export final list. Review top items for 
              a specific quarter using the BigQuery Top Items filters for Amazon and Bookstore 
              (and CruzBuy or OneCard, if needed). 
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              Which items may be overstocked or understocked?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Amazon Demand Insights, Bookstore Inventory Insights</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              Review AI-generated inventory recommendations. Open the inventory insight panel and 
              examine inventory levels, forecast ranges, and historical purchasing trends. Use 
              these recommendations to adjust inventory levels.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              How are transaction patterns changing over time?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Total Spend Over Time, Item Spend Trends, Reports</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              These help evaluate how purchasing or sales patterns change throughout the 
              academic year. Review spending trends across the available data range. Compare 
              changes across procurement sources. Search for individual items trends using 
              Item Spend Trends, if needed. Generate reports for longer-term trend analysis.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              Which purchases have the greatest financial impact?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: High Impact Items, BigQuery Top Items, Top Transaction 
                Patterns</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              These help find areas where cost savings or inventory optimization could have 
              the greatest effect. Identify items with high spend and high frequency using the 
              High Impact Items plot. Filter BigQuery Top Items for high-impact products. 
              Prioritize analysis on purchases that represent the largest financial 
              opportunities.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              I need the data attributes behind a chart or recommendation. I need to look for 
              something in the datasets.
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Dataset Explorer, BigQuery Top Items, Top Transaction Patterns 
                (Detailed Breakdown)</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              Open Dataset Explorer and search for desired items, vendors, or categories. Apply 
              filters for date ranges or categories, if needed. Export cleaned data for additional 
              analysis. If it is a top item, its data can also be viewed through the BigQuery Top 
              Items or Detailed Breakdown section.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              I need a report for a meeting.
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended: Reports</strong>
            </p>

            <p className="mt-2 text-sm text-slate-950 mb-6">
              Select the desired dataset. Choose a weekly or monthly reporting period. Generate 
              the report. Export the results for sharing.
            </p>
          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h3 className="text-2xl font-semibold mb-4 text-[#003c6c]">FAQ</h3>

        <div className="space-y-4">
          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              What data sources does SlugSmart support?
            </h4>
            <p className="mt-1 text-sm text-slate-950">
              Amazon Business, CruzBuy, OneCard/ProCard, UCSC Bookstore.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              How often should new data be uploaded?
            </h4>
            <p className="mt-1 text-sm text-slate-950">
              Whenever updated procurement or bookstore transaction data becomes
              available.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              Why does SlugSmart recommend certain items for the bookstore?
            </h4>
            <p className="mt-1 text-sm text-slate-950">
              Recommendations are generated using historical purchasing patterns, demand 
              forecasting models, inventory indicators, and purchasing trends identified 
              across procurement datasets.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              What is the difference between Amazon Demand Insights and Bookstore Inventory 
              Insights?
            </h4>
            <p className="mt-1 text-sm text-slate-950">
              Amazon Demand Insights focuses on identifying external purchasing trends that 
              may represent opportunities for bookstore stocking. Bookstore Inventory Insights 
              focuses on current bookstore inventory performance and future demand forecasts.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              Why do some items appear in multiple sections?
            </h4>
            <p className="mt-1 text-sm text-slate-950">
              Different visualizations answer different questions. The same item may appear in 
              forecasting, spending analysis, vendor analysis, and inventory recommendations because 
              it is significant from multiple perspectives.
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              What is the Purchase Plan used for?
            </h4>
            <p className="mt-1 text-sm text-slate-950">
              The Purchase Plan allows users to collect recommended products from forecasting insights 
              and export them as a procurement planning document for future bookstore stocking decisions.
            </p>
          </div>
        </div>
      </section>

      {/* STEP 4 */}
      <section>
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">
          4. CONTACT/SUPPORT
        </h2>

        <p className="mb-4 text-sm text-slate-950">
          If you encounter issues with the website, there should be someone on the
          UCSC financial team, or possibly someone from Information Technology
          Services, that could help.
        </p>

        <p className="mb-4 text-sm text-slate-950">
          SlugSmart was originally developed as a senior capstone project. As a result, 
          the original development team may not always be available to provide support.
        </p>

        <p className="text-sm text-slate-950">
          For questions related to the original development of SlugSmart, contact Joe at
          hargonbren@gmail.com.
        </p>

        <p className="mt-8 text-xs text-slate-500">
          Last Updated: May 31, 2026
        </p>
      </section>
    </div>
  );
}
