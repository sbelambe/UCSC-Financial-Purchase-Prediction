import requests, json

def test_api_endpoint():
    item_name = "shirt"
    
    # Example of a standard SuiteCommerce API endpoint:
    api_url = f"https://slugstore.ucsc.edu/api/cacheable/items?c=5711120&country=US&currency=USD&custitem_acs_filter_item_from_web=false&facet.exclude=custitem_ns_sc_ext_only_pdp%2Ccustitem_ns_sc_ext_gift_cert_group_id%2Citemtype&fieldset=details&include=&language=en&limit=4&n=2&offset=0&pricelevel=5&q={item_name}&sort=relevance%3Adesc&use_pcv=F" 
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json" # Tell the server we want data, not HTML
    }
    
    print(f"Hitting API: {api_url}")
    response = requests.get(api_url, headers=headers)
    
    data = response.json()
    print(json.dumps(data, indent=2))

if __name__ == "__main__":
    test_api_endpoint()