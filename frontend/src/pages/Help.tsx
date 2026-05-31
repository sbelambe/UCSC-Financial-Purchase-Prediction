import React from 'react';

export default function Help() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-8 text-4xl font-bold text-[#003c6c]">Help</h1>

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
          Once you are done, press the <strong>"Refresh Data"</strong> button at the
          top of the page to activate the data pipeline.
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
          applicable.
        </p>

        <h3 className="text-lg font-semibold mb-4 text-[#003c6c]">
          Data Cleaning
        </h3>

        <p className="mb-4 text-sm text-slate-950">
          The data cleaning scripts format each dataset around a consistent schema
          with columns relating to SlugSmart's purpose: Transaction Date, Item Name,
          Item Description, Category, Subcategory, Subtotal, Sales Tax, Total
          Price, Quantity, Merchant Name, Merchant State, Merchant City,
          Transaction Type, and Merchant Type. The cleaned datasets may not have all 
          of these columns due to the different formats of the raw datasets.
          This schema mostly helped to determine which columns to keep or remove.

        </p>

        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-bold text-slate-950">
            The cleaning pipeline does the following:
          </p>

          <ul className="list-disc space-y-1 pl-6 text-sm text-slate-950">
            <li>Removes sparse and unnecessary columns</li>
            <li>Normalizes missing values to NaN</li>
            <li>Renames column names to match schema names</li>
            <li>Adds new, appropriate columns</li>
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
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-slate-950">
            Since SlugSmart is built to work with tangible goods only and many rows
            are removed from the datasets during the cleaning process, SlugSmart is
            not a reflection of overall UCSC spending/sales data and should not be
            used for such.
          </p>
        </div>

        <h3 className="text-lg font-semibold mb-4 text-[#003c6c]">Storage</h3>

        <p className="mb-6 text-sm text-slate-950">
          The cleaned data is uploaded to the Firestore database. SlugSmart pulls
          from the most recent data upload.
        </p>

        <h3 className="text-lg font-semibold mb-4 text-[#003c6c]">
          ML Retraining
        </h3>

        <p className="text-sm text-slate-950">
          Pressing the <strong>"Refresh Data"</strong> button activates retraining
          of the ML model. This ensures predictions and insights are based on the
          most up-to-date data.
        </p>
      </section>

      {/* STEP 3 */}
      <section className="mb-10">
        <h2 className="mb-4 text-3xl font-bold text-[#003c6c]">3. USE</h2>

        <p className="mb-8 text-sm text-slate-950">
          Explore purchase/sales activity, identify spending trends, forecast
          future purchases, monitor inventory-related insights, and more.
        </p>

        <h3 className="text-lg font-semibold mb-4 text-[#003c6c]">WHERE</h3>

        <p className="mb-4 text-sm text-slate-950">Where can I find X?</p>

        <h4 className="mb-4 text-lg font-semibold text-[#003c6c]">Sitemap</h4>

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
              Dataset Pages: Deep dive into a specific dataset
            </p>

            <ul className="list-disc pl-6 text-sm text-slate-950">
              <li>BigQuery Top Items</li>
              <li>Transaction Analytics</li>
              <li>Amazon Demand Insights / Inventory Insights</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm font-bold text-slate-950">
              Dataset Explorer: View, manipulate, and export cleaned transaction
              data
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="mb-2 text-sm font-bold text-slate-950">
              Reports: Generate summary reports for personal use or meetings and
              presentations
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-950">
          Each component also has an info description in its card so you understand
          what it is and its purpose.
        </p>

        <h3 className="mt-8 text-lg font-semibold mb-4 text-[#003c6c]">HOW</h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              I just uploaded new data. How do I verify everything processed
              correctly?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended:</strong> Key Metrics, Top Items Across Datasets,
              Top External Vendors, Dataset Explorer
            </p>
          </div>

          <div>
            <h4 className="text-base font-semibold text-[#003c6c]">
              Where is UCSC spending the most money on tangible goods?
            </h4>

            <p className="mt-2 text-sm text-slate-950">
              <strong>Recommended:</strong> Top Items Across Datasets, Top External
              Vendors, BigQuery Top Items, Top Transaction Patterns, Total Spend
              Over Time
            </p>
          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold mb-4 text-[#003c6c]">FAQ</h3>

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
          Given this was a senior capstone project, the original developers are not
          actively working on the website and may not always be available for help.
        </p>

        <p className="text-sm text-slate-950">
          However, you can contact developer Joe at
          <strong> hargonbren@gmail.com</strong>.
        </p>

        <p className="mt-8 text-xs text-slate-500">
          Last Updated: May 31, 2026
        </p>
      </section>
    </div>
  );
}
