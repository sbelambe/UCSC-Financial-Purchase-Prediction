from .firebase import db
from google.cloud.firestore import FieldFilter

def get_item_freq(user_id: str, limit: int = 20):
    """
    Queries the 'summaries' collection group for all 'top_items_detailed' documents.
    Groups the results by dataset (amazon, cruzbuy, pcard) to perfectly match 
    the structure of the frontend's preview_data.json.
    """
    print("Fetching pre-calculated summaries from 'summaries' collection group...")
    
    try:
        docs = db.collection_group("summaries").where(filter=FieldFilter("name", "==", "top_items_detailed")).stream()
        
        # 1. Initialize buckets to match your preview_data.json keys
        grouped_stats = {
            "amazon": {},
            "cruzbuy": {},
            "pcard": {}
        }
        
        doc_count = 0
        for doc in docs:
            doc_count += 1
            data = doc.to_dict()
            
            # 2. Identify which platform this document belongs to
            dataset = data.get("dataset", "unknown").lower()
            payload = data.get("payload", {})
            items = payload.get("items", [])
            
            # If a new dataset appears, safely initialize it
            if dataset not in grouped_stats:
                grouped_stats[dataset] = {}
                
            target_group = grouped_stats[dataset]

            for item in items:
                name = item.get("clean_item_name", "").strip()
                if not name:
                    continue

                if name not in target_group:
                    target_group[name] = {
                        "clean_item_name": name,
                        "count": 0,
                        "total_spent": 0.0,
                        "vendors": set()
                    }
                
                # --- SAFEGUARD: Handle legacy string data ---
                raw_spent = item.get("total_spent", 0.0)
                if isinstance(raw_spent, str):
                    try:
                        clean_spent = float(raw_spent.replace('$', '').replace(',', '').strip())
                    except ValueError:
                        clean_spent = 0.0
                else:
                    clean_spent = float(raw_spent)
                # --------------------------------------------
                
                target_group[name]["count"] += item.get("count", 0)
                target_group[name]["total_spent"] += clean_spent
                
                vendors = item.get("vendors", [])
                if isinstance(vendors, list):
                    for v in vendors:
                        target_group[name]["vendors"].add(v)
                elif isinstance(vendors, str):
                    target_group[name]["vendors"].add(vendors)

        if doc_count == 0:
            print("No detailed summary documents found! Run the ETL script first.")
            return {"amazon": [], "cruzbuy": [], "pcard": []}
            
        print(f"Successfully fetched and grouped data from {doc_count} summary documents.")
        
        # 3. Format the final output to mirror preview_data.json
        final_result = {}
        for ds, items_dict in grouped_stats.items():
            final_list = list(items_dict.values())
            for item in final_list:
                item["vendors"] = list(item["vendors"])
                
            # Sort each section independently and apply the limit
            final_list.sort(key=lambda x: x["count"], reverse=True)
            final_result[ds] = final_list[:limit]

        return final_result
            
    except Exception as e:
        print(f"CRITICAL FIREBASE ERROR: {e}")
        return {"amazon": [], "cruzbuy": [], "pcard": []}