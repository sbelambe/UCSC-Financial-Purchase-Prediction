from .firebase import db
from google.cloud.firestore import FieldFilter

def get_item_freq(user_id: str, limit: int = 20):
    """
    Queries the 'summaries' collection group for all 'top_items_detailed' documents, 
    merges the results, and returns the highest frequency items.
    """
    print("Fetching pre-calculated summaries from 'summaries' collection group...")
    
    try:
        # Fetch only documents named "top_items_detailed" across all uploads
        docs = db.collection_group("summaries").where(filter=FieldFilter("name", "==", "top_items_detailed")).stream()
        
        # Merge dictionary to combine stats across multiple uploads
        merged_stats = {}
        
        doc_count = 0
        for doc in docs:
            doc_count += 1
            payload = doc.to_dict().get("payload", {})
            items = payload.get("items", [])
            
            for item in items:
                name = item["clean_item_name"]
                if name not in merged_stats:
                    merged_stats[name] = {
                        "clean_item_name": name,
                        "count": 0,
                        "total_spent": 0.0,
                        "vendors": set()
                    }
                
                merged_stats[name]["count"] += item["count"]
                merged_stats[name]["total_spent"] += item["total_spent"]
                for v in item["vendors"]:
                    merged_stats[name]["vendors"].add(v)

        if doc_count == 0:
            print("No detailed summary documents found! Run the ETL script first.")
            return []
            
        print(f"Successfully merged data from {doc_count} summary documents.")
        
        # Convert sets back to lists for JSON serialization
        final_list = list(merged_stats.values())
        for item in final_list:
            item["vendors"] = list(item["vendors"])
            
        # Sort by count descending and apply limit
        final_list.sort(key=lambda x: x["count"], reverse=True)
        return final_list[:limit]
            
    except Exception as e:
        print(f"CRITICAL FIREBASE ERROR: {e}")
        return []