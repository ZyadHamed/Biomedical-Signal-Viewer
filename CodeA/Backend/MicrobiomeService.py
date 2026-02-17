import numpy as np
import pandas as pd

def GetDiarrheaPatientProfile(df_path: str, patientIndex: int):
    full_df = pd.read_csv(df_path)
    bad_bacteria = ['Haemophilus', 'Campylobacter', 'Streptococcus', 'Escherichia/Shigella']
    good_bacteria = ['Prevotella', 'Bacteroids', 'Bacteroides', 'Faecalibacterium', 'Dialister', 
                    'Collinsella', 'Clostridium sensu stricto 1', 'Blauita', 'Blautia', 'Megasphaera']

    BadBacteriaSum = 0.0
    GoodBacteriaSum = 0.0

    BacteriaProfile = {}

    # 2. Select the first patient
    patient = full_df.iloc[patientIndex]

    # 3. Loop through all the column names (using .index)
    for column in patient.index:
        # Convert column name to lowercase to make matching easier
        col_name = str(column).lower()
        
        # Extract the numeric value of the count
        count_value = patient[column]
        
        # Skip any non-numeric columns (like Sample_ID or Status) to avoid math errors
        if isinstance(count_value, (int, float)):
            # Check if ANY of the bad bacteria are a substring of this column name
            for bad in bad_bacteria:
                if bad.lower() in col_name:
                    BadBacteriaSum += count_value
                    if(bad in BacteriaProfile):
                        BacteriaProfile[bad] += count_value
                    else: 
                        BacteriaProfile[bad] = count_value
            
            # Check if ANY of the good bacteria are a substring of this column name
            for good in good_bacteria:
                if good.lower() in col_name:
                    GoodBacteriaSum += count_value
                    if(good in BacteriaProfile):
                        BacteriaProfile[good] += count_value
                    else:
                        BacteriaProfile[good] = count_value

    if(GoodBacteriaSum == 0):
        DI = -1
    else:
        DI = BadBacteriaSum / GoodBacteriaSum
    
        IsPatient = False
    if(patient["Case or control participant [EUPATH_0010375]"] == "Case"):
        IsPatient = True
    return BadBacteriaSum, GoodBacteriaSum, DI, IsPatient, patient["Participant_Id"].replace("(Source)", ""), BacteriaProfile

def GetHydrocephalusPatientProfile(df_path: str, patientIndex: int):
    full_df = pd.read_csv(df_path)
    bad_bacteria = ['Paenibacillus', 'unclassified Mitochondria', 'unclassified proteobacteria', 
                    'unclassified Rickettsiales', 'unclassified Alphaproteobacteria', 
                    'unclassified Euglenozoa', 'Tepidimonas', 'Micrococcus', 'Rothia', 'Aphagea']

    good_bacteria = ['Pseudomonas', 'Escherichia/Shigella', 'unclassified Halomonadaceae', 
                    'Diaphorobacter', 'Leuconostoc']

    BadBacteriaSum = 0.0
    GoodBacteriaSum = 0.0

    BacteriaProfile = {}

    # 2. Select the first patient
    patient = full_df.iloc[patientIndex]

    # 3. Loop through all the column names (using .index)
    for column in patient.index:
        # Convert column name to lowercase to make matching easier
        col_name = str(column).lower()
        
        # Extract the numeric value of the count
        count_value = patient[column]
        
        # Skip any non-numeric columns (like Sample_ID or Status) to avoid math errors
        if isinstance(count_value, (int, float)):
            # Check if ANY of the bad bacteria are a substring of this column name
            for bad in bad_bacteria:
                if bad.lower() in col_name:
                    BadBacteriaSum += count_value
                    if(bad in BacteriaProfile):
                        BacteriaProfile[bad] += count_value
                    else: 
                        BacteriaProfile[bad] = count_value
            
            # Check if ANY of the good bacteria are a substring of this column name
            for good in good_bacteria:
                if good.lower() in col_name:
                    GoodBacteriaSum += count_value
                    if(good in BacteriaProfile):
                        BacteriaProfile[good] += count_value
                    else:
                        BacteriaProfile[good] = count_value

    if(GoodBacteriaSum == 0):
        DI = -1
    else:
        DI = BadBacteriaSum / GoodBacteriaSum
    
    IsPatient = False
    if(patient["Hydrocephalus [HP_0000238]"] == "Postinfectious hydrocephalus (PIH)"):
        IsPatient = True
    return BadBacteriaSum, GoodBacteriaSum, DI, IsPatient, patient["Participant_Id"].replace("(Source)", ""), BacteriaProfile

def GetDiabetesPatientProfile(df_path: str, patientIndex: int):
    full_df = pd.read_csv(df_path)
    bad_bacteria = [
        'Agathobaculum', 'Gordonibacter', 'Eggerthella', 'Hungatella', 
        'Faecalibacterium', 'Streptococcus', 'Parabacteroides', 'Flavonifractor', 
        'Lachnoclostridium', 'Intestinimonas', 'Eisenbergiella', 'Tyzzerella', 
        'Lawsonibacter', 'Anaerostipes', 'Sellimonas', 'Actinomyces', 
        'Anaerotruncus', 'Coprococcus', 'Blautia', 'Parasutterella', 
        'Erysipelatoclostridium', 'Bacteroids'
    ]

    good_bacteria = [
        'Dialister', 'Odoribacter', 'Escherichia'
    ]

    BadBacteriaSum = 0.0
    GoodBacteriaSum = 0.0

    BacteriaProfile = {}

    # 2. Select the first patient
    patient = full_df.iloc[patientIndex]

    # 3. Loop through all the column names (using .index)
    for column in patient.index:
        # Convert column name to lowercase to make matching easier
        col_name = str(column).lower()
        
        # Extract the numeric value of the count
        count_value = patient[column]
        
        # Skip any non-numeric columns (like Sample_ID or Status) to avoid math errors
        if isinstance(count_value, (int, float)):
            # Check if ANY of the bad bacteria are a substring of this column name
            for bad in bad_bacteria:
                if bad.lower() in col_name:
                    BadBacteriaSum += count_value
                    if(bad in BacteriaProfile):
                        BacteriaProfile[bad] += count_value
                    else: 
                        BacteriaProfile[bad] = count_value
            
            # Check if ANY of the good bacteria are a substring of this column name
            for good in good_bacteria:
                if good.lower() in col_name:
                    GoodBacteriaSum += count_value
                    if(good in BacteriaProfile):
                        BacteriaProfile[good] += count_value
                    else:
                        BacteriaProfile[good] = count_value

    if(GoodBacteriaSum == 0):
        DI = -1
    else:
        DI = BadBacteriaSum / GoodBacteriaSum
    
    IsPatient = False
    if(patient["Type 1 diabetes diagnosed [EUPATH_0009043]"] == "Yes"):
        IsPatient = True
    return BadBacteriaSum, GoodBacteriaSum, DI, IsPatient, patient["Participant_Id"].replace("(Source)", ""), BacteriaProfile
