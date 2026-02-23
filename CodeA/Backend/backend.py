from fastapi import FastAPI, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from MicrobiomeService import generate_frontend_json
from DroneClassificationService import ClassifyDroneSignal
from EEGService import npy_to_json, PredictEEGSignal
from ECGService import mat_to_json, PredictECGSignal, PredictECGSignalMLBased

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
ALLOWED_Dataset_Extensions_For_Stocks = {'.csv'}
ALLOWED_Dataset_Extensions_For_Drone_Detection = {'.wav', '.mp3'}
ALLOWED_Dataset_Extensions_For_EEG_Conversion = {'.npy'}
ALLOWED_Dataset_Extensions_For_ECG_Conversion = {'.mat'}

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

@app.post("/converteegtojsonandclassify")
async def ConvertEEGToJSONAndClassify(file: UploadFile):
    try:
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_EEG_Conversion:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_EEG_Conversion)}"
                },
            status_code=400
            )
        

        with open("uploadedFiles/EEGFiles/" + file.filename, "wb") as binary_file:
            binary_file.write(contents)
        
        fileJSON = npy_to_json("uploadedFiles/EEGFiles/" + file.filename)
        samplingFreq = {
        "epileptic_interictal": 256, 
        "alcoholism_05": 160,
        "mental_stress": 500,
        "motor_abnormality": 160,
        "normal": 160,
        "seizure": 256
        }
        
        fs = next((freq for key, freq in samplingFreq.items() if key in file.filename), None)
        classification, confidence = PredictEEGSignal("uploadedFiles/EEGFiles/" + file.filename, fs)
        responseDTO = {"diagnosis": classification, "confidence": confidence, "data": fileJSON}
        return responseDTO

    except Exception:
        return JSONResponse(
            content = {
                "message:": Exception
                },
            status_code=500
            )
    

@app.post("/convertecgtojsonandclassify")
async def ConvertECGToJSONAndClassify(file: UploadFile):
    try:
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_ECG_Conversion:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_ECG_Conversion)}"
                },
            status_code=400
            )
        

        with open("uploadedFiles/ECGFiles/" + file.filename, "wb") as binary_file:
            binary_file.write(contents)
        
        fileJSON = mat_to_json("uploadedFiles/ECGFiles/" + file.filename)
        
        classification, confidence = PredictECGSignal("uploadedFiles/ECGFiles/" + file.filename)

        classificationML, confidenceML = PredictECGSignalMLBased("uploadedFiles/ECGFiles/" + file.filename)
        responseDTO = {"diagnosis": classification, "confidence": confidence, "MLDiagnosis": classificationML, "MLConfidence":confidenceML, "data": fileJSON}
        return responseDTO

    except Exception:
        return JSONResponse(
            content = {
                "message:": Exception
                },
            status_code=500
            )
    

@app.post("/predictstock")
async def PredictStock(file: UploadFile):
    try:
        contents = await file.read()
        file_extension = os.path.splitext(file.filename)[-1]
        if file_extension not in ALLOWED_Dataset_Extensions_For_Stocks:
            return JSONResponse(
            content = {
                "message:": f"Invalid file type. Allowed dataset formats: {', '.join(ALLOWED_Dataset_Extensions_For_Stocks)}"
                },
            status_code=400
            )
        

        with open("uploadedFiles/Stocks/" + file.filename, "wb") as binary_file:
            binary_file.write(contents)
        
        fileJSON = mat_to_json("uploadedFiles/ECGFiles/" + file.filename)
        
        classification, confidence = PredictECGSignal("uploadedFiles/ECGFiles/" + file.filename)

        classificationML, confidenceML = PredictECGSignalMLBased("uploadedFiles/ECGFiles/" + file.filename)
        responseDTO = {"diagnosis": classification, "confidence": confidence, "MLDiagnosis": classificationML, "MLConfidence":confidenceML, "data": fileJSON}
        return responseDTO

    except Exception:
        return JSONResponse(
            content = {
                "message:": Exception
                },
            status_code=500
            )
    