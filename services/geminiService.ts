
import { GoogleGenAI, Type } from "@google/genai";
import { Student, Teacher } from "../types.ts";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateFinancialReport = async (students: Student[], monthName: string): Promise<string> => {
  const summaryData = students.map(s => {
    let totalHours = 0;
    let totalCost = 0;
    Object.values(s.attendance).forEach(entry => {
        if (entry.deleted) return;
        totalHours += entry.hours;
        const rate = (s.rates[entry.type as keyof typeof s.rates] as number) || 0;
        totalCost += entry.hours * rate;
    });
    const totalPaid = s.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = totalPaid - totalCost;
    return { name: s.name, totalHours, balance };
  });

  const prompt = `Analyze: ${JSON.stringify(summaryData)} for ${monthName}. Provide a summary and payment reminders.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    return response.text || "Could not generate report.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Error generating report.";
  }
};

export const analyzeReceipt = async (base64Image: string): Promise<{ amount: number; date?: string; studentName?: string }> => {
  const prompt = "Analyze this payment receipt. Extract the total amount paid, the date of payment, and the student's name if mentioned. Return the data in JSON format: { \"amount\": number, \"date\": \"YYYY-MM-DD\", \"studentName\": \"string\" }";
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: "image/jpeg"
            }
          }
        ]
      }]
    });
    const text = response.text || "";
    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error("Could not parse receipt data");
  } catch (error) {
    console.error("Error analyzing receipt:", error);
    throw error;
  }
};

export const chatWithAI = async (
  message: string, 
  history: { role: 'user' | 'model'; parts: { text: string }[] }[],
  context: { students: Student[]; teachers: Teacher[] }
) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: `You are TutorTrack AI, a helpful assistant for managing a tutoring business. 
        You can help the user manage students, teachers, and lessons.
        Current Data Context:
        Students: ${JSON.stringify(context.students.map(s => ({ id: s.id, name: s.name, teacherId: s.teacherId })))}
        Teachers: ${JSON.stringify(context.teachers)}
        
        When the user asks to perform an action (like adding a student, canceling a lesson, etc.), 
        use the provided functions.
        
        Rules for teachers other than Rémi:
        - Classes won't be validated if there is no receipt attached.
        - Every payment should match a receipt amount.
        - AI should check if all receipts match the total amount of lessons displayed.`,
        tools: [
          {
            functionDeclarations: [
              {
                name: "add_student",
                description: "Add a new student to the system",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING, description: "Student name" },
                    teacherId: { type: Type.STRING, description: "ID of the teacher assigned to this student" },
                    groupName: { type: Type.STRING, description: "Optional group name" }
                  },
                  required: ["name", "teacherId"]
                }
              },
              {
                name: "cancel_lesson",
                description: "Cancel a lesson for a student on a specific date and time",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    studentId: { type: Type.STRING, description: "ID of the student" },
                    date: { type: Type.STRING, description: "Date of the lesson (YYYY-MM-DD)" },
                    startTime: { type: Type.STRING, description: "Optional start time (HH:mm)" }
                  },
                  required: ["studentId", "date"]
                }
              },
              {
                name: "log_lesson",
                description: "Log or update a lesson for a student",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    studentId: { type: Type.STRING, description: "ID of the student" },
                    date: { type: Type.STRING, description: "Date of the lesson (YYYY-MM-DD)" },
                    hours: { type: Type.NUMBER, description: "Duration in hours" },
                    type: { type: Type.STRING, description: "Type of lesson (online, onsite, home)" },
                    startTime: { type: Type.STRING, description: "Start time (HH:mm)" },
                    status: { type: Type.STRING, description: "Status of the lesson (confirmed, planned)" }
                  },
                  required: ["studentId", "date", "hours", "type"]
                }
              },
              {
                name: "add_payment",
                description: "Add a payment record for a student",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    studentId: { type: Type.STRING, description: "ID of the student" },
                    amount: { type: Type.NUMBER, description: "Payment amount" },
                    note: { type: Type.STRING, description: "Optional note" }
                  },
                  required: ["studentId", "amount"]
                }
              }
            ]
          }
        ]
      }
    });

    const functionCalls = response.functionCalls;

    return {
      text: response.text || (functionCalls ? "Processing your request..." : "No response from AI"),
      functionCalls: functionCalls
    };
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
};
