import os
from google.cloud import bigquery
from dotenv import load_dotenv

load_dotenv()

class BQClient:
    def __init__(self):
        # Explicitly set project to avoid quota issues
        self.project_id = os.getenv("BILLING_PROJECT", "mn-org-box-01")
        self.client = bigquery.Client(project=self.project_id)
        self.dataset_id = os.getenv("DATASET_ID", "LG_SBA")
        self.table_id = os.getenv("TABLE_ID", "lg_revenue")
        self._cache = {} # In-memory cache for DataFrames

    def get_group_revenue(self):
        if 'group' in self._cache:
            return self._cache['group'].to_dict(orient='records')
            
        query = f"""
        SELECT 
            usage_month, 
            cns_sba_yn, 
            customer_name_1, 
            SUM(MRR) as mrr
        FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
        GROUP BY 1, 2, 3
        ORDER BY 1 ASC
        """
        df = self.client.query(query).to_dataframe()
        self._cache['group'] = df
        return df.to_dict(orient='records')

    def get_entity_revenue(self, entity_name):
        if entity_name in self._cache:
            return self._cache[entity_name].to_dict(orient='records')
            
        query = f"""
        SELECT *
        FROM `{self.project_id}.{self.dataset_id}.{self.table_id}`
        WHERE customer_name_1 = @entity
        ORDER BY usage_month ASC
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("entity", "STRING", entity_name)
            ]
        )
        df = self.client.query(query, job_config=job_config).to_dataframe()
        self._cache[entity_name] = df
        return df.to_dict(orient='records')

    def clear_cache(self):
        self._cache = {}

bq_client = BQClient()
