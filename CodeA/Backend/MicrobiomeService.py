import numpy as np
import pandas as pd
import json

def get_main_bacteria_name(taxon_string):
    """
    Extracts the genus-level name from a taxonomic string.
    Falls back to higher levels if genus isn't available.
    """
    parts = taxon_string.split('|')
    
    genus = None
    for part in parts:
        if part.startswith('g__'):
            genus = part[3:]
            break
    
    if genus and not genus.endswith('_noname') and not genus.endswith('_unclassified'):
        return genus
    
    # Fall back to family
    for part in parts:
        if part.startswith('f__'):
            family = part[3:]
            if not family.endswith('_noname') and not family.endswith('_unclassified'):
                return family
    
    # Fall back to order
    for part in parts:
        if part.startswith('o__'):
            order = part[3:]
            if not order.endswith('_noname') and not order.endswith('_unclassified'):
                return order
    
    # Fall back to phylum
    for part in parts:
        if part.startswith('p__'):
            phylum = part[3:]
            if not phylum.endswith('_noname') and not phylum.endswith('_unclassified'):
                return phylum
    
    return parts[-1].split('__')[-1]  # last resort

def get_aggregated_participant_data(participant_index, tax_df, metadata_df):
    participants = ['C3001', 'C3002', 'C3003', 'C3004', 'C3005', 'C3006', 'C3011',
       'C3015', 'C3016', 'C3017', 'C3021', 'C3022', 'C3023', 'C3027',
       'C3029', 'C3030', 'C3031', 'C3032', 'C3034', 'C3035', 'C3037',
       'H4001', 'H4004', 'H4006', 'H4007', 'H4008', 'H4009', 'H4010',
       'H4013', 'H4014', 'H4015', 'H4016', 'H4017', 'H4018', 'H4019',
       'H4020', 'H4022', 'H4023', 'H4024', 'H4028', 'H4031', 'H4035',
       'H4038', 'H4039', 'H4040', 'H4042', 'H4043', 'H4044', 'H4045',
       'M2008', 'M2014', 'M2021', 'M2025', 'M2026', 'M2027', 'M2028',
       'M2034', 'M2039', 'M2041', 'M2042', 'M2047', 'M2060', 'M2061',
       'M2064', 'M2068', 'M2069', 'M2072', 'M2075', 'M2084', 'P6005',
       'P6009', 'P6012', 'P6013', 'P6014', 'P6016', 'P6017', 'P6018',
       'P6024', 'P6025', 'P6028', 'P6033', 'C3008', 'C3009', 'C3010',
       'C3012', 'C3013', 'C3028', 'E5004', 'E5009', 'H4027', 'H4030',
       'H4032', 'P6010', 'E5013', 'E5001', 'M2048', 'M2071', 'M2077',
       'M2079', 'M2083', 'M2085', 'M2097', 'M2103', 'P6035', 'P6037',
       'P6038', 'C3007', 'C3019', 'C3020', 'C3024', 'C3033', 'C3036',
       'E5002', 'E5003', 'E5006', 'E5008', 'E5019', 'E5022', 'E5023',
       'H4011', 'H4012', 'M2010', 'M2024', 'M2058', 'M2059', 'M2067',
       'M2081', 'M2082', 'M2086', 'M2091', 'M2044']

    participant_id = participants[participant_index]
    # 1. Filter the metadata for the target participant and 'metagenomics'
    patient_meta = metadata_df[(metadata_df['Participant ID'] == participant_id) & 
                               (metadata_df['data_type'] == 'metagenomics')]
    
    # 2. Extract and validate the Sample IDs
    sample_ids = patient_meta['External ID'].tolist()
    valid_sample_ids = [sid for sid in sample_ids if sid in tax_df.columns]
    patient_meta = patient_meta[patient_meta['External ID'].isin(valid_sample_ids)]
    
    
    # Safety check: If the participant has no data, stop here and return an empty dataframe
    if len(valid_sample_ids) == 0:
        print("Warning: No valid samples found. Returning empty DataFrame.")
        return pd.DataFrame()

    # 3. Extract, transpose, and merge the data
    patient_tax = tax_df[valid_sample_ids].T
    merged_df = patient_meta.merge(patient_tax, left_on='External ID', right_index=True)
    
    # Clean up and set index to week_num
    columns_to_keep = ['week_num', 'diagnosis', 'External ID'] + list(patient_tax.columns)
    final_df = merged_df[columns_to_keep]
    final_df = final_df.set_index('week_num').sort_index()
    
    # 4. Separate metadata from numeric bacteria columns
    metadata_cols = ['diagnosis', 'External ID']
    meta_df = final_df[metadata_cols]
    bacteria_df = final_df.drop(columns=metadata_cols).astype(float)
    
    # 5. Rename columns using your custom taxonomy function
    new_column_names = [get_main_bacteria_name(col) for col in bacteria_df.columns]
    bacteria_df.columns = new_column_names
    
    # 6. Group by the new column names and sum (aggregate) the duplicates
    aggregated_bacteria_df = bacteria_df.groupby(bacteria_df.columns, axis=1).sum()
    
    # 7. Recombine and return
    final_aggregated_df = pd.concat([meta_df, aggregated_bacteria_df], axis=1)
        
    return final_aggregated_df, participant_id

import json
import pandas as pd
import numpy as np

def generate_frontend_json(participant_index, tax_df_path, metadata_df_path):
    """
    Takes a participant index, extracts their aggregated microbiome data, 
    calculates the Dysbiosis Index (DI), and formats it into a clean JSON.
    """
    metadata_df = pd.read_csv(metadata_df_path, low_memory=False)
    tax_df = pd.read_csv(tax_df_path, sep='\t', index_col=0)
    # 1. Run your provided function to get the dataframe and ID
    final_aggregated_df, participant_id = get_aggregated_participant_data(participant_index, tax_df, metadata_df)
    
    if final_aggregated_df.empty:
        return json.dumps({"error": f"No valid data found for index {participant_index} ({participant_id})."})

    diagnosis = final_aggregated_df['diagnosis'].iloc[0]

    # 2. Define our master lists of Genera
    bad_bacteria_genera = ['Klebsiella', 'Fusobacterium', 'Intestinibacter', 'Clostridium', 
                           'Escherichia', 'Bacteroides', 'Veillonella', 'Ruminococcus']
    good_bacteria_genera = ['Faecalibacterium', 'Eubacterium', 'Roseburia', 
                            'Akkermansia', 'Bifidobacterium']

    # 3. Helper function to format the series arrays
    def format_series(target_genera, df):
        series_list = []
        for bug in target_genera:
            if bug in df.columns:
                bug_data = df[bug].dropna() 
                data_points = [{"week": int(week), "value": float(val)} for week, val in bug_data.items()]
                if data_points:
                    series_list.append({"name": bug, "data": data_points})
        return series_list

    # --- NEW: 4. Calculate the Dysbiosis Index (DI) ---
    
    # Find which of our target bugs actually exist in this patient's data
    present_bad = [bug for bug in bad_bacteria_genera if bug in final_aggregated_df.columns]
    present_good = [bug for bug in good_bacteria_genera if bug in final_aggregated_df.columns]
    
    # Sum the abundances per week (if none exist, default to 0)
    bad_sum = final_aggregated_df[present_bad].sum(axis=1) if present_bad else pd.Series(0, index=final_aggregated_df.index)
    good_sum = final_aggregated_df[present_good].sum(axis=1) if present_good else pd.Series(0, index=final_aggregated_df.index)
    
    # Apply the Log10 ratio with a pseudocount (1e-5) to prevent division by zero or log(0)
    pseudocount = 1e-5
    di_series = (bad_sum + pseudocount) / (good_sum + pseudocount)
    
    # Format the DI into the same {week, value} JSON structure
    di_data = [{"week": int(week), "value": round(float(val), 4)} for week, val in di_series.dropna().items()]

    # 5. Build the final payload
    frontend_payload = {
        "participant_id": participant_id,
        "diagnosis": diagnosis,
        "Dysbiosis_Index": di_data,  # <--- Newly added DI array,
        "Average_Dysbiosis_Index": float(di_series.mean()),
        "Good_Bacteria": format_series(good_bacteria_genera, final_aggregated_df),
        "Bad_Bacteria": format_series(bad_bacteria_genera, final_aggregated_df)
    }

    return frontend_payload