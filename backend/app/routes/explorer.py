import io
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.dataset_explorer import export_dataset_explorer_rows, get_dataset_explorer_rows

router = APIRouter(tags=["explorer"])

@router.get("/api/dataset-explorer")
def dataset_explorer(
    dataset: str = "amazon",
    page: int = 1,
    page_size: int = 25,
    search: str = "",
    search_field: str = "all",
    merchant: str = "",
    category: str = "",
    start_date: str = "",
    end_date: str = "",
    sort_by: str = "Transaction Date",
    sort_dir: str = "desc",
):
    try:
        data = get_dataset_explorer_rows(
            dataset=dataset,
            page=page,
            page_size=page_size,
            search=search,
            search_field=search_field,
            merchant=merchant,
            category=category,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Exports the dataset explorer results
@router.get("/api/dataset-explorer/export")
def dataset_explorer_export(
    dataset: str = "amazon",
    search: str = "",
    search_field: str = "all",
    merchant: str = "",
    category: str = "",
    start_date: str = "",
    end_date: str = "",
    sort_by: str = "Transaction Date",
    sort_dir: str = "desc",
    format: str = Query("csv", pattern="^(csv|xlsx|json)$"),
):
    try:
        export_payload = export_dataset_explorer_rows(
            dataset=dataset,
            search=search,
            search_field=search_field,
            merchant=merchant,
            category=category,
            start_date=start_date,
            end_date=end_date,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

        rows = export_payload["rows"]
        columns = export_payload["columns"]
        df = pd.DataFrame(rows, columns=columns)
        base_name = f"{export_payload['dataset']}_dataset_export"

        if format == "csv":
            buffer = io.StringIO()
            df.to_csv(buffer, index=False)
            file_buffer = io.BytesIO(buffer.getvalue().encode("utf-8"))
            media_type = "text/csv"
            filename = f"{base_name}.csv"
        elif format == "xlsx":
            file_buffer = io.BytesIO()
            with pd.ExcelWriter(file_buffer, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Dataset Explorer")
            file_buffer.seek(0)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{base_name}.xlsx"
        else:
            json_buffer = io.StringIO()
            df.to_json(json_buffer, orient="records", indent=2, force_ascii=False)
            file_buffer = io.BytesIO(json_buffer.getvalue().encode("utf-8"))
            media_type = "application/json"
            filename = f"{base_name}.json"

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
        return StreamingResponse(file_buffer, media_type=media_type, headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))