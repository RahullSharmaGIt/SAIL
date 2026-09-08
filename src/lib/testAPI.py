from google import genai

client = genai.Client(api_key="AQ.Ab8RN6KQn18O-lnpmiJZM70ODX99H6b3AThdgL3BAhn7gakTk")

response = client.models.generate_content(
    model="gemini-3.7-flash",
    contents="Which model are you"
)

print(response.text)