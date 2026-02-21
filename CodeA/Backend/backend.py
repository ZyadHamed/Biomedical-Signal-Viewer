from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from MicrobiomeService import generate_frontend_json
from DroneClassificationService import ClassifyDroneSignal

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

ALLOWED_Dataset_Extensions_For_Microbiome = {'.csv', '.gz'}
ALLOWED_Dataset_Extensions_For_Drone_Detection = {'.wav', '.mp3'}


@app.post("/uploadmicrobiomedataset")
async def UploadMicrobiomeDataset(metadataFile: UploadFile, taxonomyFile: UploadFile):
    try:
        contents = await metadataFile.read()
        file_extension = os.path.splitext(metadataFile.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_Microbiome:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_Microbiome)}"
                },
            status_code=400
            )
        with open("uploadedFiles/microbiomeMetadataFile" + file_extension, "wb") as binary_file:
            binary_file.write(contents)

        contents = await taxonomyFile.read()
        file_extension = os.path.splitext(taxonomyFile.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_Microbiome:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_Microbiome)}"
                },
            status_code=400
            )
        with open("uploadedFiles/microbiomeTaxonomyFile" + file_extension, "wb") as binary_file:
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
async def GetMicroBiomePatientData(participantIndex: int):

    responseDTO = generate_frontend_json(participantIndex, "uploadedFiles/microbiomeTaxonomyFile.gz", "uploadedFiles/microbiomeMetadataFile.csv")
    return responseDTO


@app.post("/classifydronesound")
async def ClassifyDroneSound(file: UploadFile):
    try:
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_Drone_Detection:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_Drone_Detection)}"
                },
            status_code=400
            )
        

        with open("uploadedFiles/uploadedDroneDetectionSound" + file_extension, "wb") as binary_file:
            binary_file.write(contents)
        
        classification = ClassifyDroneSignal("uploadedFiles/uploadedDroneDetectionSound" + file_extension, "droneClassifier.joblib")
        responseDTO = {
                "message": "Success",
                "AudioClass": classification
            }
        return responseDTO

    except Exception:
        return JSONResponse(
            content = {
                "message:": Exception
                },
            status_code=500
            )




