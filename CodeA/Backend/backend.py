from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from MicrobiomeService import GetDiarrheaPatientProfile, GetHydrocephalusPatientProfile, GetDiabetesPatientProfile

import os
from pydantic import BaseModel



app = FastAPI()
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory="static"), name="static")

ALLOWED_Dataset_Extensions_For_Microbiome = {'.csv'}


@app.post("/uploadmicrobiomedataset")
async def create_upload_file(diseaseName: str, file: UploadFile):
    try:
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_Microbiome:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_Microbiome)}"
                },
            status_code=400
            )
        
        if(diseaseName == "Diarrhea"):
            with open("microbiomeDataDiarrhea" + file_extension, "wb") as binary_file:
                binary_file.write(contents)
        elif(diseaseName == "Hydrocephalus"):
            with open("microbiomeDataHydrocephalus" + file_extension, "wb") as binary_file:
                binary_file.write(contents)

        elif(diseaseName == "Diabetes"):
            with open("microbiomeDataDiabetes" + file_extension, "wb") as binary_file:
                binary_file.write(contents)
        
        responseDTO = {
                "message": "Success",
            }
        return responseDTO

    except Exception:
        return JSONResponse(
            content = {
                "message:": Exception
                },
            status_code=500
            )

@app.get("/getmicrobiomepatientdata")
async def GetMicroBiomePatientData(diseaseName: str, participantIndex: int):
    responseDTO = {}
    if(diseaseName == "Diarrhea"):
        BadBacteriaSum, GoodBacteriaSum, DI, actualPrediction, participantID, BacteriaProfile = GetDiarrheaPatientProfile("microbiomeDataDiarrhea.csv", participantIndex)
        responseDTO = {
            "message": "Success",
            "participantID": participantID,
            "BacteriaProfile": BacteriaProfile,
            "BadBacteriaSum": BadBacteriaSum,
            "GoodBacteriaSum": GoodBacteriaSum,
            "DI": DI,
            "HasDisease": actualPrediction
        }
    elif(diseaseName == "Hydrocephalus"):
        BadBacteriaSum, GoodBacteriaSum, DI, actualPrediction, participantID, BacteriaProfile = GetHydrocephalusPatientProfile("microbiomeDataHydrocephalus.csv", participantIndex)
        responseDTO = {
            "message": "Success",
            "participantID": participantID,
            "BacteriaProfile": BacteriaProfile,
            "BadBacteriaSum": BadBacteriaSum,
            "GoodBacteriaSum": GoodBacteriaSum,
            "DI": DI,
            "HasDisease": actualPrediction
        }
    
    elif(diseaseName == "Diabetes"):
        BadBacteriaSum, GoodBacteriaSum, DI, actualPrediction, participantID, BacteriaProfile = GetDiabetesPatientProfile("microbiomeDataDiabetes.csv", participantIndex)
        responseDTO = {
            "message": "Success",
            "participantID": participantID,
            "BacteriaProfile": BacteriaProfile,
            "BadBacteriaSum": BadBacteriaSum,
            "GoodBacteriaSum": GoodBacteriaSum,
            "DI": DI,
            "HasDisease": actualPrediction
        }

    return responseDTO