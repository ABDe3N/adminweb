#!/usr/bin/env python3
"""
Script to convert simple text question format to JSON format.
Converts animals_clean.txt format to questions_export.json format.
"""

import json
import uuid
from datetime import datetime
from typing import List, Dict, Any

def parse_txt_questions(file_path: str) -> List[Dict[str, Any]]:
    """
    Parse the text file and extract questions with their options.
    
    Expected format:
    Question text?
    Correct answer
    Wrong answer 1
    Wrong answer 2
    Wrong answer 3
    (blank line)
    """
    questions = []
    
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = [line.strip() for line in file.readlines()]
    
    i = 0
    while i < len(lines):
        # Skip empty lines
        if not lines[i]:
            i += 1
            continue
        
        # Get question text
        question_text = lines[i]
        i += 1
        
        # Get the four options (correct answer first, then wrong answers)
        options = []
        for j in range(4):
            if i < len(lines) and lines[i]:
                options.append(lines[i])
                i += 1
            else:
                break
        
        # Only process if we have a question and 4 options
        if len(options) == 4:
            questions.append({
                "question_text": question_text,
                "options": options
            })
        
        # Skip any remaining empty lines
        while i < len(lines) and not lines[i]:
            i += 1
    
    return questions

def get_category_choice() -> str:
    """
    Display category menu and get user's choice.
    Available categories: Literature, Islamic, History, Geography, Animals, Sports, General, Science, Language, Riddles
    """
    # Arabic categories for JSON output
    arabic_categories = [
        "إسلاميات",
        "تاريخ", 
        "جغرافيا",
        "حيوانات",
        "رياضة",
        "علوم",
        "آداب",
        "لغة",
        "عامة",
        "ألغاز"
    ]
    
    # English display names
    english_names = [
        "Islamic",
        "History", 
        "Geography",
        "Animals",
        "Sports",
        "Science",
        "Literature",
        "Language",
        "General",
        "Riddles"
    ]
    
    print("\n" + "="*50)
    print("Choose category for the questions:")
    print("="*50)
    
    for i, (arabic, english) in enumerate(zip(arabic_categories, english_names), 1):
        print(f"{i:2d}. {english}")
    
    print("="*50)
    
    while True:
        try:
            choice = input("Enter category number (1-10): ")
            choice_num = int(choice)
            
            if 1 <= choice_num <= 10:
                selected_category = arabic_categories[choice_num - 1]
                selected_english = english_names[choice_num - 1]
                print(f"\nSelected category: {selected_english}")
                return selected_category
            else:
                print("Error: Please enter a number between 1 and 10")
                
        except ValueError:
            print("Error: Please enter a valid number")

def determine_difficulty(question_text: str) -> int:
    """
    Always returns difficulty level 1 as requested.
    1 = Easy
    """
    return 1

def create_json_output(questions: List[Dict[str, Any]], output_file: str):
    """
    Create the final JSON output matching the questions_export.json format.
    """
    export_data = {
        "export_info": {
            "exported_at": datetime.now().isoformat(),
            "total_questions": len(questions),
            "source": "Text file conversion",
            "note": "Converted from simple text format. Correct answer is always the first option.",
            "removed_fields": []
        },
        "questions": questions
    }
    
    with open(output_file, 'w', encoding='utf-8') as file:
        json.dump(export_data, file, ensure_ascii=False, indent=2)
    
    print(f"Successfully converted {len(questions)} questions to {output_file}")

def main():
    """Main function to run the conversion."""
    input_file = "animals_clean.txt"
    output_file = "animals_clean_converted.json"
    
    try:
        print(f"Reading questions from {input_file}...")
        raw_questions = parse_txt_questions(input_file)
        
        if not raw_questions:
            print("No questions found in the input file.")
            return
        
        print(f"Parsed {len(raw_questions)} questions")
        
        # Get category choice from user
        selected_category = get_category_choice()
        
        # Process questions with user-selected category
        processed_questions = []
        for question_data in raw_questions:
            # Generate a unique ID
            question_id = str(uuid.uuid4()).replace('-', '')[:20]
            
            # Create question object with user-selected category
            question_obj = {
                "id": question_id,
                "question_text": question_data["question_text"],
                "options": question_data["options"],
                "category": selected_category,
                "difficulty": determine_difficulty(question_data["question_text"])
            }
            
            processed_questions.append(question_obj)
        
        print(f"\nCreating JSON output: {output_file}...")
        create_json_output(processed_questions, output_file)
        
        # Print sample of converted data
        if processed_questions:
            print("\nSample converted question:")
            print(json.dumps(processed_questions[0], ensure_ascii=False, indent=2))
            
    except FileNotFoundError:
        print(f"Error: Could not find input file '{input_file}'")
    except Exception as e:
        print(f"Error during conversion: {e}")

if __name__ == "__main__":
    main() 