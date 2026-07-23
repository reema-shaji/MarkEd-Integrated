import os
import openai
import fitz
import json
import re
from MarkEd.models import AssignmentElement
from django.conf import settings
from enum import Enum
import logging
from datetime import datetime
from openai.types.chat import ChatCompletion

# Remove the hardcoded key and use the one from settings
openai.api_key = settings.OPENAI_API_KEY

# Configure logger
logger = logging.getLogger('openai_api')

# OpenAI API Pricing (per 1M tokens) just as reference
# +---------------+---------------+---------------+------------+
# | Model         | Input         | Cached input  | Output     |
# +---------------+---------------+---------------+------------+
# | gpt-4o        | $2.50         | $1.25         | $10.00     |
# | gpt-4o-mini   | $0.15         | $0.075        | $0.60      |
# | o1            | $15.00        | $7.50         | $60.00     |
# | o3-mini       | $1.10         | $0.55         | $4.40      |
# | o1-mini       | $1.10         | $0.55         | $4.40      |
# +---------------+---------------+---------------+------------+
# Comparison: https://artificialanalysis.ai/
class OpenAIModels(str, Enum):
    GPT_4O = 'gpt-4o'
    GPT_4O_MINI = 'gpt-4o-mini' 
    O3_MINI = 'o3-mini' 
    

# Chat with GPT-3
def chat(query, model=OpenAIModels.GPT_4O_MINI, temperature=0.1, system_message=None, max_tokens=500):
    if not system_message:
        system_message = "Act as a critical marker/adviser. Analyze the student's work thoroughly, focusing on providing constructive criticism and detailed feedback for improvement. The feedback should be insightful, critical, and helpful, aiming to guide the student in enhancing their understanding and skills."

    start_time = datetime.now()
    
    try:
        if model == OpenAIModels.O3_MINI:
            # o3-mini is cannot have temperature or max_tokens
            response: ChatCompletion = openai.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": query}
                ]
            )
        else:
            response: ChatCompletion = openai.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": query}
                ],
                temperature=temperature,
                max_tokens=max_tokens
            )
        
        # Log the API call details
        logger.info(
            "OpenAI API Call | "
            f"Time: {datetime.now()} | "
            f"Duration: {datetime.now() - start_time} | "
            f"Model: {model} | "
            f"Prompt Tokens: {response.usage.prompt_tokens} | "
            f"Completion Tokens: {response.usage.completion_tokens} | "
            f"Total Tokens: {response.usage.total_tokens} | "
            f"Temperature: {temperature} | "
            f"Max Tokens: {max_tokens}"
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        logger.error(
            "OpenAI API Error | "
            f"Time: {datetime.now()} | "
            f"Model: {model} | "
            f"Error: {str(e)}"
        )
        raise

def get_structure(assignment_id):
    structure = {}
    elements = AssignmentElement.objects.filter(assignment__id=assignment_id)
    for element in elements:
        structure[element.elementName] = element.maxInput
    return structure

# Parse the pdf file
def parse_pdf(pdf_path):
    # Open the PDF file
    pdf_document = fitz.open(pdf_path)
    text_content = ''

    # Regular expression to match lines that are empty, full of spaces, or consist of dots
    # This pattern looks for lines with only whitespace (including spaces, tabs, etc.) or dots
    pattern = re.compile(r'^[\s.]*$', flags=re.MULTILINE)

    # Iterate over each page
    for page_number in range(len(pdf_document)):
        # Get a page
        page = pdf_document.load_page(page_number)

        # Extract text from the page and strip whitespace
        page_text = page.get_text().strip()

        # Remove irrelevant formatting using regex
        page_text = pattern.sub('', page_text)

        # Add cleaned text to the overall text content
        text_content += page_text + '\n'

    # Close the document
    pdf_document.close()

    return text_content

# def parse_mark_scheme_manually():
#     mark_scheme = {}
#     mark_scheme['Task 1'] = """Task 1: Stakeholders (5)
#                                None: (0) Not attempted
#                                Unacceptable: (1) Much fewer than the minimum number of stakeholders required were identified, or many of them are incorrect. The notion of a stakeholder was barely understood
#                                Poor: (2) Fewer than the minimum number of stakeholders required were identified, or some of them are incorrect. Stakeholder notion partially understood.
#                                Fair: (3) At least the minimum number of stakeholders were identified, but they are only taken from the spec, and the justifications are sometimes unclear (not clear if notion fully understood). 
#                                Good: (4) All the task requirements were respected without considering a wide variety of stakeholders, and the justifications are always clear. Notion correctly understood.
#                                Excellent: (5) Excellent choice of wide variety of stakeholders, demonstrating excellent understanding of the context, and very clear justifications"""
#     mark_scheme['Task 2'] = """Task 2: Ambiguities and addressing them (10)
#                                None: (0) Not attempted
#                                Unacceptable: (2) Very few ambiguities discussed even if some others were addressed later in the coursework
#                                Poor: (4) A small number of ambiguities discussed even if some others addressed later. Requirements elicitation techniques only partially understood.
#                                Fair: (6) Reasonable number of ambiguities, reasonably matching those addressed later. Some reasonable assumptions and/or who to approach. Elicitation techniques not fully understood.
#                                Good: (8) Good number of ambiguities, usually matching those addressed later. Good vision of who to approach and how, assumptions. Elicitation techniques understood.
#                                Excellent: (10) A lot of effort in interpreting the spec, with excellent considerations of context in the choice of who to approach and elicitation techniques."""
#     mark_scheme['Task 3'] = """Task 3: Use case diagram and use case prioritisation (15)
#                                None: (0) Not attempted
#                                Unacceptable: (3) Very incomplete use case diagram, with mistakes in the notation and many missing use cases (more than half)
#                                Poor: (6) Some mistakes in the use case diagram notation. Many missing use cases and actors. and actors. Use case concept not properly understood.
#                                Fair: (9) Use case diagram notation mostly correct. A couple of missing use cases and/or actors. Use case concept understood, actor concept partially understood. Prioritisation a good start but incomplete discussion or considering only one criterion for deciding priority.
#                                Good: (12) Use case diagram notation, use cases, actors all understood. All main use cases and actors identified. Prioritisation a reasonable discussion considering a few criteria.
#                                Excellent: (15) No mistakes or omissions in the diagram. Very good sense of the scope of the chosen use cases. Prioritisation an excellent discussion considering several criteria, showing excellent understanding of the context."""
#     mark_scheme['Task 4'] = """Task 4: Use case descriptions (20)
#                                None: (0) Not attempted
#                                Unacceptable: (4) Very incomplete answer, not meeting numbers of use cases required to be described and/or with mostly incorrect use of template.
#                                Poor: (8) Some of the use cases required were not covered and/or many mistakes/ omissions in the interpretation of the use case templates' main success scenario and extensions.
#                                Fair: (12) Meeting the number/detail requirements, attempt to reference use cases where useful. A few of the fields other than main success scenario and extensions not understood, and a few mistakes/ omissions.
#                                Good: (16) Meeting the number/detail requirements, referencing use cases, max. one template field misinterpreted. Reasonably complete wrt. spec & assumptions (Task 2), consistent (no contradictions)
#                                Excellent: (20) Meeting the number/detail requirements, referencing use cases, template all correctly interpreted. Complete wrt. spec & assumptions, and consistent."""
#     mark_scheme['Task 5'] = """Task 5: Non- functional requirements (10)
#                                None: (0) Not attempted
#                                Unacceptable: (2) Very incomplete answer, not meeting numbers of categories/ non- functional reqs or meeting but incorrect formatting, and incorrect understanding of notion of non-functional req.
#                                Poor: (4) Numbers of categories/ non- functional reqs not fully met and/or frequent mix with functional reqs and not all categories understood.
#                                Fair: (6) Meeting the number of categories/ non-functional reqs. Notion of non-functional requirement and categories understood, with small omissions. <2 measurable requirements, or measurable not understood.
#                                Good: (8) Meeting the number of categories/ non-functional reqs, at minimum or with little variety for the reqs. Notion of non-functional requirement and categories fully understood. At least 2 reqs measurable.
#                                Excellent: (10) A lot of effort to consider a variety of categories and provide a variety of correct measurable non-functional requirements."""
#     mark_scheme['Task 6'] = """Task 6: The software development (15)
#                                None: (0) Not attempted
#                                Unacceptable: (3) A good amount of effort at attempting questions a-b) but mostly incorrectly (even f answers correct, reasoning incorrect)
#                                Poor: (6) Correct answers to a-b) but still some important mistakes in the reasoning, and understanding of the notions unconvincing. For groups of 4, unconvincing answer for d).
#                                Fair: (9) Correct answers to a-b-(for groups of 4) d), with very small mistakes in reasoning. For groups of 3-4, a mostly unsuccessful attempt at c).
#                                Good: (12) All answers correct, with very small mistakes in reasoning.
#                                Excellent: (15) All answers correct, with reasoning showing having done a good amount of reading and having a good understanding of theory and practice."""
#     mark_scheme['Task 7'] = """Task 7: Reflection (10)
#                                None: (0) Not attempted
#                                Unacceptable: (2) Little use of reflection – mostly broad unjustified, even dishonest statements
#                                Poor: (4) Some use of reflection but generally too brief or only on team work/work.
#                                Fair: (6) An attempt to use the given reflective model or similar on a few of the suggested topics for team work, or to touch on a few aspects of the work, or more but just in one. Min. half a page.
#                                Good: (8) A good attempt to use the given reflective model or similar on a good number of the topics for team work and work. Some discussion of tools for team work and the marking scheme. Min. half a page.
#                                Excellent: (10) An excellent attempt showing a highly reflective team, touching on most of the proposed topics, tools and the marking scheme. Would normally expect around a page."""
#     mark_scheme['Exceptionality'] = """15 marks that can be awarded at the discretion of the marker if mark of >80 (max=85) reached for exceptional knowledge of theory, exceptional putting it in practice in given case study, exceptional team work."""

#     return mark_scheme

# def parse_question_paper_manually():
#     question_paper = {}
#     question_paper['Task 1'] = """Task 1: Stakeholders. Identify the stakeholders of the system and, for each stakeholder, describe how the system impacts them. Groups of 2: Write down at least 6 stakeholders. Groups of 3: Write down at least 8 stakeholders. Groups of 4: Write down at least 10 stakeholders. Regardless how many stakeholders you are providing, start with those that are mentioned in the system description and user interviews above (which may or may not already cover the minimum number of stakeholders you are requested). Then, make sure that you also add at least one additional stakeholder that would make sense in the context provided, but was not mentioned. There is no need here to cover stakeholders common to most software development projects (i.e., software architects, designers, developers and testers), and you will not receive credit if you do."""
#     question_paper['Task 2'] = """Task 2: Ambiguities and addressing them. The system description from the government and the interview responses omits many details, and may even be misleading on particular points. Note that for future courseworks, a lot of these issues will be resolved and clarified, but for this one, you need to identify them and discuss how you would handle them. As you go through this coursework, make sure you return to this task each time you find a new ambiguity and/or you need to make new assumptions. All of these should be discussed centrally in this task. In this task, write a bulleted list of ambiguities you identify. Make sure each item in the list contains:
    
#                                   • Details of the ambiguity: what is unclear / ambiguous given the system description and interviews? What are different ways to address this in the system?
#                                   • Who to approach and how: If you wanted to clarify this ambiguity, who would you approach, and how would you try to clarify things (i.e. which requirement elicitation techniques are suitable)?
#                                   • Assumptions: If for any subsequent task you need to make assumptions regarding the identified ambiguity, clearly state these assumptions. Why did you choose to make these particular assumptions? Your answers to subsequent tasks should be consistent with your answer to this task.
                                  
#                                   We provide one example of an ambiguity with answers to the questions above to give you an idea of what we expect in each of your list items (not all your items need to be this long):
                                  
#                                   Example: "What information is needed from entertainment providers when they register on the system? Currently, the description doesn't specify any. This point should be discussed with both the providers and the government (as they may require certain company information) during interviews or facilitated meetings. For subsequent tasks, we assume only basic information is required, such as organisation name, main address, email, phone number, representative name(s), because this is usually the bare minimum contact information for a company.""""
#     question_paper['Task 3'] = """Task 3: Use case diagram and use case prioritisation. Now consider the use cases for the system. For now, just think about them on a high level, without going into the details of each use case.
                                    
#                                   a) Draw a UML use case diagram showing visually the use cases that you have identified and the actor(s) (both primary and supporting ones) that each is associated with. You may either draw this by hand and include a high-quality scan of your diagram in your report or use a software tool such as draw.io. Your use case diagram must contain the use cases "Book event", "Create event" and "Cancel event" (note: the entire event and not a booking for it). Regardless of group size, try to cover the entire system as described. It is unlikely you will be able to do that with any less than 13 use cases (including the 3 from above). Keep these use cases as high level as possible, i.e. it is better to represent as a use case a large piece of functionality rather than its steps, unless those steps can be used independently or repeated in several contexts.
                                  
#                                   b) Under the diagram, take each of your identified use cases in turn and state whether in your view it should be high-priority (i.e. it is essential for the system's operation and should thus be within the first features to implement) or low-priority (i.e. it is an optional feature that isn't so important for the system's operation and main goal), and justify this decision briefly using all information that was given to you. Should this prioritisation be your decision?"""
#     question_paper['Task 4'] = """Task 4: Use case descriptions. Describe the use cases you identified in the previous task in more detail. To this end, your solution should include:
                                  
#                                   a) A full description using the template provided in the Tutorial 2 question sheet used for the Week 3 tutorials of the following use cases:
#                                   • "Book event"
#                                   • "Cancel event"
#                                   • For larger groups only, some more use cases - see below.
                                  
#                                   b) A shorter description using a simpler format with just the primary actor, supple- mentary actor(s) if relevant, and a maximum 6-sentence free-text summary of the use case and its interactions, for some of the simpler use cases. See exact number below. Regardless of group size, one of these simpler use cases should always be "Create Event".
                                  
#                                   Groups of 2: Write full descriptions for the 2 use cases mentioned in a) above. Write shorter descriptions as explained in b) for "Create event" and another 3 use cases, starting with any remaining high-priority ones.
                                  
#                                   Groups of 3: Write full descriptions for the 2 use cases mentioned in a) above plus another high-priority use case you identified in Task 3. Write shorter descriptions as explained in b) for "Create event" and another 4 use cases, starting with any remaining high-priority ones.
                                  
#                                   Groups of 4: Write full descriptions for the 2 use cases mentioned in a) above plus another 2 use cases, starting with any remaining high-priority ones you identified in Task 3. Write shorter descriptions as explained in b) for "Create event" and for another 5 use cases you, starting with any remaining high-priority ones.
                                  
#                                   Some guidelines:
#                                   • The use cases should be about the main interactions between actors external to the system and the system itself and should explain what is supposed to happen from the user's point of view. They should not be concerned with the details of user interface interactions or how the system handles everything underneath: you are not doing design at this stage.
#                                   • Feel free to add extra fields in the template if you feel it would help, but don't omit fields from it unless the answer to them is 'None'.
#                                   • In your descriptions, write both the main success scenario, but also any and all alternative scenarios.
#                                   • Make sure you reference use cases from within the descriptions where this would shorten the explanation, as exemplified in Tutorial 1 solutions."""
#     question_paper['Task 5'] = """Task 5: Non-functional requirements. Describe non-functional requirements which are relevant for the system. There are various general categories of non-functional requirements including Security, Performance, Privacy, Usability, Platform Compatibility, Availability, Accessibility, Interoperability, and Data Retention. Identify some of these categories which could be relevant to this system, and for each, give some examples of non-functional requirements in this category which could apply to the system. Write the requirements using the format for a requirements specification shown to you in Lecture 4. In at least a few of these requirements, add enough concrete details that someone reading the requirements would have some idea of how to measure them and assess whether they are being met (i.e. make these requirements measurable).
    
#                                   Groups of 2: Identify at least 2 categories and 5 non-functional requirements.
#                                   Groups of 3: Identify at least 3 categories and 6 non-functional requirements.
#                                   Groups of 4: Identify at least 4 categories and 7 non-functional requirements."""
#     question_paper['Task 6'] = """Task 6: The software development. For this section you should consider the assignment in terms of the type of system that is being developed, and the software process used to develop this system. For each item below, we expect 2-4 sentences.
    
#                                   1. For the app that is being developed and your role within this development, and disregarding your tasks (i.e., the way you started work on it) in this assignment, would software project engineering or software product engineering be a better choice? Please justify your answer, both in terms of the reasons for choosing it, and those for which the other option was less desirable.
                                  
#                                   2. Of the two types of software engineering processes that we have studied in this course, which of them have we been using for requirements engineering in this assignment? Why do you think this is the case?
                                  
#                                   3. Groups of 3 & 4: Would the other type of software development process have been better in this context? Justify your reply.
                                  
#                                   4. Groups of 4: If we were instead using the other software development process, how would have requirements engineering been performed? Give some specific differences."""
#     question_paper['Task 7'] = """Task 7: Reflection. This section asks you to reflect and self-assess your team's progress with this coursework. This is a great opportunity to take the time to learn from your experience with this coursework, and thus develop your analytical thinking skills. It will also help you judge your work before we do, by interacting with the marking scheme and thus gaining an understanding of how you are being marked. Before you start doing any reflection, here is a useful model (adapted from the Integrated Reflective Cycle (Bassot, 2013)) that you could use to structure your reflection:
    
#                                   1. The Experience: Describe what you did, what you tried out.
#                                   2. Reflection on Action: What were the results? What went well? What didn't? Why?
#                                   3. Theory: What have you learned from this experience?
#                                   4. Preparation: What could you have done to make things better, according to the lessons learned? If you have the chance to do this again (e.g. team work), what will you do or try out next time to try to make things better? You can see an example of this model being put to use at this link.
                                  
#                                   Write one paragraph with your reflection on each of the following topics (we expect between half a page and one page in total for both topics, with more effort gaining more credit):
                                  
#                                   1. Teamwork: here, reflect on things such as how you got organised, split up responsi- bilities between team members, communicated, and managed progress in working towards the deadline for this coursework. Make sure to mention and reflect on the use of and usefulness of any tools that you tried out in this process, e.g. physical tools or online tools for managing your team work.
                                  
#                                   2. The quality of your work: here, reflect on how well you think you tackled the work in the different tasks. We recommend you have a look at the marking scheme from this link to help you structure this response, however touching on all criteria from there, or marking yourself using it is not expected.
                                  
#                                   Important! You should make a real effort to be reflective, as well as honest, in this task. Please note that only making bold statements like "We did this excellently well", with no justification, and (even worse!) not being open to consider that there is always room for improvement, will result in very little, or even no, credit for this part."""
#     question_paper['Exceptionality'] = """"""

#     return question_paper
    
# def parse_student_answer_manually():
#     questions = {}
#     questions['Task 1'] = """1.One of the stakeholders is event organisers, as they will be using the system to organise safe COVID events, therefore may increase profits as they will be able to host more approved events.
#                              2.Another stakeholder is the attendees themselves, as the app will provide a means for the attendees to safely travel to the event, such as bus and taxi services and a map. The app will also allow them to purchase cheaper, government-sponsored tickets, saving them money.
#                              3.The government is a stakeholder as we need to ensure that our app complies with their policies, and lets them be aware of events that occur, making sure that they don't clash, and that COVID regulations are being followed.
#                              4.Entertainment providers are stakeholders as they are affected by a potential increased cash flow through an easier booking process for attendees increasing numbers.
#                              5.The NHS are a stakeholder who will be provided with data to allow for tracking COVID-19 cases for use in research.
#                              6.The event staff are stakeholders as this app has the potential to lower COVID risks by ensuring COVID-19 procedures are being followed correctly, and gives more work opportunities, ensuring that more people are employed.
#                              7.The local transportation services are stakeholders as the app prevents overcrowding when there are increased volumes of people, as the app has a map that will guide people to the next event efficiently away from public roads. They also get increased cash flow from an increased number of people using their services.
#                              8.Local communities are a stakeholder as the app may potentially cause increased traffic and noise pollution, so we need to ensure that they are aware.
#                              9.Our app supports local businesses as there will be more customers, and venues to set up stalls to provide for attendees.
#                              10.The app may cause protestors to protest against covid events despite them being NHS and government-approved,so we need to be aware of their motives and try to provide enough information to ease their worries."""
#     questions['Task 2'] = """•The first ambiguity spotted is for payment details. It is unclear how payment is to be made through the app, and the role of the app in this process. For actions such as booking a taxi or buying a ticket, payment details are required to be sent to us or another service such as PayPal, who will be the medium to sending the money to the relevant services e.g. taxis and event organisers. We should use some elicitation sequences to find out what the prospective users want, such as surveys. Then with this information, we can check if this complies with the government's standards and include it in the terms and conditions of the app. We are assuming that the customers want to pay with the app as a medium rather than be linked to an external taxi app.
#                              •Another ambiguity is profile preferences. When searching for events, users are presented with options that match their 'profile preferences" and it is unclear what these should consist of. We should reach the prospective users (general public) to ask them what their needs are when searching for events, by using elicitation techniques such as interviews and surveys. An assumption is that this includes COVID-19 preferences such as how safe they want to be, and therefore be shown less crowded areas accordingly.
#                              •The map system requested is also an ambiguity. The majority (80) want a mapping system but the complexity of such as system can vary greatly, as we need to know whether it should simply show the road or go into further detail such as showing nearby landmarks, which greatly increases the complexity of this system. We should ask cartographers by interview what the most important aspects of a map are for simple navigation. We also could simply use a Google maps API. This is assuming that the user wants the mapto be a part of the app and not a redirect to Google maps.
#                              •The rating system is another ambiguity, as a percentage of interviewees (20) have asked for a rating system for each event, but it is unclear on what the rating should be, as aspect specific rating could be much more helpful for event organisers, such as separate ratings for communication, enjoyment, organisation etc. For this, we could use statisticians on what has worked best in similar projects, and for further analysis when the app is released to try to make the rating system as effective as possible. This is assuming that customers are willing to put in the time to rate multiple aspects of an event."""
#     questions['Task 3'] = """Diagram:
#                                               |  Organiser specific  |   Both            |  User sepcific              |
#                                               |                      |   Register        |                             |
#                                               |  Create Event        |   Login           |  Create profile             |
#                              Event Organiser -|> Update Event       -|-> Make a payment -|> Book Event                -|> User
#                                               |  Cancel Event        |   Access map      |  Search for events          |
#                                               |                      |                   |  Request transport details  |
#                                               |                      |                   |  Cancel booking             |
#                                               |                      |                   |  Leave review               |
                             
#                              High priority:
#                              Book event, create event and cancel event are high priority because they are the core
#                              functionality of the app as an event management system. Being able to cancel events is also
#                              a high priority as attendees may mistakenly sign up for an event they cannot partake in, and
#                              by cancelling they can give back that space to someone who wants and can attend. Being
#                              able to register and login is also a high priority as this is what individualises the experience
#                              to each attendee and event organiser, so attendees can keep track of the events they have
#                              booked into, and event organisers can keep track of their events. After registering the user
#                              should be able to create a profile to be able to select how comfortable being near crowds of
#                              people, which we can use for deciding upon transport services and whether certain venues
#                              should be recommended or not due to crowding. Making a payment is a high priority use-
#                              case as we need to allow users to pay money to the local communities safely and securely
#                              and is also useful for transport which was requested by some interviewees (14). Since
#                              accessing a map is requested by most interviewees (80), it is a high priority use case.
#                              Requesting transport details is also a high priority for a similar reason where half (45) of the
#                              interviewees requested a way to check public transport information to get to and from the
#                              event.
                             
#                              Low priority:
#                              The ability to search, review and check weather forecasts for an event is a low priority as
#                              they were requested by a minority of users, 20, 16 and 14 respectively, and are also not a
#                              core feature of the app. The ability for event organisers to update the event is also
#                              considered a low priority as this is not a core feature and may confuse clients if abused."""
#     questions['Task 4'] = """Book event

#                              Name: Book event
#                              Brief Description: The user book their ticket and make the payment
#                              Primary Actor: Consumer
#                              Supporting Actors: Event organizer
#                              Trigger: The user chooses the event that they want to attend, and book ticket for the event
#                              Pre-Conditions:
#                              Title Description:
#                              There are tickets left for the event.
#                              Guarantees:
#                              Success Guarantees: The system ask consumer to confirm their booking detail and ask them to do the payment
#                              Failure Guarantees: The consumer cannot jump to the payment step and is asked to try again
#                              Minimal Guarantees:
#                              Main Success Scenario:
#                              1. Consumer selects "book event" option in the event homepage.
#                              2. User enters the booking details (Name, Email, number of tickets)
#                              3. User clicks the confirm button and jump to the payment page.
#                              4. User enters payment details.
#                              5. Payment is made.
#                              6. System receives the booking details.
#                              Extension Points:
#                              Start Point and Title: Steps
#                              Booking email is incorrect: The system may ask user to enter the email again so that they can receive the booking information.
#                              The event has already begun: The system will remind the user that the event already begun and ask them whether they still want to book the ticket.
#                              Notes:
#                              None None
                             
#                              Cancel event
                             
#                              Name: Book event
#                              Brief Description: Event's organiser can cancel their event
#                              Primary Actor: Event organiser
#                              Supporting Actors: Payment system
#                              Trigger: Event cancellation button is clicked
#                              Pre-Conditions:
#                              Title Description:
#                              Existing button The event that the organiser is trying to cancel is present in the system.
#                              Guarantees:
#                              Success Guarantees: The event is shown as cancelled, refunds are issued to consumers and consumers are notified.
#                              Failure Guarantees: The event is not cancelled.
#                              Minimal Guarantees: The organiser is notified of the outcome.
#                              Main Success Scenario:
#                              1. The request to cancel the event is sent to the system.
#                              2. The ticket holders are notified that the event is cancelled.
#                              3. The tickets to the event are refunded using the payment system.
#                              4. The organiser is notified that the event is successfully cancelled
#                              Extension Points:
#                              Start Point and Title: Steps
#                              3 – Wrong payment system: Correct payment system is contacted instead
#                              Notes:
#                              None None
                             
#                              Login
                             
#                              Name: Login
#                              Brief Description: Login to the app using a username and password to access features
#                              Primary Actor: Guest
#                              Supporting Actors: Database
#                              Trigger: Guest is prompted to enter their login details or register a new account.
#                              Pre-Conditions:
#                              Title Description:
#                              None None
#                              Guarantees:
#                              Success Guarantees: Guest is logged in to their account and have the right privileges with all the features they should have access to.
#                              Failure Guarantees: The guest is told they could not be logged in and were not logged into their account
#                              Minimal Guarantees: The login request is sent to the service and the user is notified of the result
#                              Main Success Scenario:
#                              1. User enters their username and password
#                              2. User requests login from System
#                              3. The system validates the username and password, makes sure the username is in the System and the password matches the account.
#                              4. User is logged into their own account and returned to the dashboard.
#                              5. The use case ends
#                              Extension Points:
#                              Start Point and Title: Steps
#                              4 – User authentication fails authentication:
#                              1. The system displays the reasons why the user failed authentication
#                              2. The system presents changes to the user which are necessary to pass authentication
#                              3. The system prompts the user to re-enter th evlaid details
#                              4. The Basic Flow continues where the User continues to enter new information (from step 2)
#                              Notes:
#                              None None
                             
#                              Register
                             
#                              Name: Register
#                              Brief Description: Register the user onto the system
#                              Primary Actor: Guest
#                              Supporting Actors: Database
#                              Trigger: Guest is prompted to enter their login details or register a new account
#                              Pre-Conditions:
#                              Title Description:
#                              None None
#                              Guarantees:
#                              Success Guarantees: New account is registered with the details of the user and the user's desired features
#                              Failure Guarantees: No account is registered for one or more reasons and the user can re attempt registration
#                              Minimal Guarantees: The register request is sent to the system and the guest is notified of the result
#                              Main Success Scenario:
#                              1. The system prompts the guest to enter their details.
#                              2. The guest enters their details 
#                              3. The system validates their details, making sure no duplicate exists in the system.
#                              4. The guest is registered onto the system and returned to a login page.
#                              5. The use case ends
#                              Extension Points:
#                              Start Point and Title: Steps
#                              2 – User cancels registration 
#                              1. The guest selects the cancel option.
#                              2. They're returned to the dashboard of the app
#                              3 – User validation fails 
#                              1. Guest requests registration
#                              2. The system displays the necessary
#                              3. Guest is prompted to re-enter correct information
#                              Notes:
#                              None None
                             
#                              Shorter descriptions

#                              Create Event is a use case where the primary actor is the event organiser, and the
#                              supporting actor is the payment system. The event organiser will have the option to cancel
#                              their events. If they do, the system will send a notification to the customers and send a
#                              request to the payment system to refund any tickets to the cancelled event automatically.
#                              Finally, the event organisers should be informed of a successful event cancellation.
#                              Access Map use case's primary actor is the consumer who opens the map. Potentially, the
#                              secondary actor could be an external map application. If the map is handled entirely within
#                              the app, then the consumer would simply be directed to the page which displays the map. If
#                              we're using an external map, then the system would need to direct the user to a map
#                              interface provided by the external app.
 
#                              Request transport details include both primary and secondary actors. The primary actor is
#                              the consumer, and the secondary actor is potentially the system that provides the transport
#                              information. if the requirements say that the consumers want real-time transport
#                              information, then after the information is requested, the system needs to get the relevant
#                              data from an external provider and then display said data to the consumer. Else, the
#                              transport data is included in the app and is displayed when the consumer requests it.
#                              Leave review has the primary actor as the consumer and the database which holds the
#                              reviews as the secondary actor. The user can choose to review an event that they have
#                              already attended. After submitting a review, the review should be recorded in the database and then the
#                              consumer should be notified that the review was successfully received.
 
#                              Cancel booking is where the consumer, as the primary actor, can enter a booking number
#                              and initiate a request to cancel their booking to a specific event, which is more than 24h
#                              away. The system then contacts the database containing the bookings, as the secondary
#                              actor, and given that the booking number is correct cancels the booking for the consumer.
#                              The consumer should be notified of the outcome, and given a successful cancellation, a
#                              refund should be issued by the payment system, which is another secondary actor.
 
#                              Make a payment is where the consumers or event organisers, as primary actors, can pay
#                              money to the app for buying tickets, items such as food, transport or rent space for the
#                              event from within the app. The secondary actors are the bank or payment services such as
#                              PayPal that they use for payment. The success guarantee is that payment is successfully
#                              made to the app to be transferred to the relevant receiver, such as taxi service, government
#                              council or stall owner and the failure guarantee is that no payment is made, allowing users
#                              to decide whether they would like to try again or cancel the payment."""
#     questions['Task 5'] = """1. Security
#                              1.1 The system should provide access only to legitimate users. This can be tested using penetration testing.
#                              1.2 The system should be resilient in the event of an attack. We can test this by trying to login without being a valid user.
#                              2 Accessibility
#                              2.1 The system should be accessible to all users, including those with disabilities e.g. the visually impaired. We can measure this against accessibility guidelines. Performance
#                              3.1 The system should perform well even with high demand / high traffic. We can check how the system performs at an expected high load and check response rates.
#                              3.2 The system should be snappy with little delay between button presses. We can test button response times with software, such as using the timeit function in python.
#                              4 Usability
#                              4.1 The system should be obvious to use e.g. descriptive button names and colour contrast. We can measure this using beta testing and getting feedback on ease of use.
#                              4.2 The system should be error-tolerant, for example, if users enter the wrong email, it is quick to reinput, up to five tries for security."""
#     questions['Task 6'] = """1. For the app that is being developed and your role within this development, and
#                              disregarding your tasks (ie., the way you started work on it) in this assignment, would
#                              software project engineering or software product engineering be a better choice?
#                              Please justify your answer, both in terms of the reasons for choosing it and those for
#                              which the other option was less desirable.

#                              Software project engineering would be a better choice in this scenario for many reasons. The
#                              features of the system arise from requirements set out by the customer and the
#                              stakeholders and the development of the system is based on their requirements. The system
#                              is also funded by the government as a customer. The lifetime of the system is also
#                              determined by the customer and any changes made to the system are paid for by the
#                              customer. In contrast, software product engineering is centred around an opportunity
#                              identified by the developers with features arising from the developers' visions.

#                              2. Of the two types of software engineering processes that we have studied in this
#                              course, which of them have we been using for requirements engineering in this
#                              assignment? Why do you think this is the case?

#                              We have been following a plan-driven approach, documenting our steps using UML and
#                              detailed descriptions of use cases. This is because this coursework is purely about
#                              requirements engineering and following an agile process would have required iterative
#                              working software, which is not in the scope of this coursework. There is no requirement for
#                              change given by the coursework documentation. Our software is to be fully functional upon
#                              release, with no further elicitation past the initial interviews (given) and ambiguities
#                              clarification.

#                              3. Groups of 3 & 4: Would the other type of software development process have been
#                              better in this context? Justify your reply.

#                              For software project engineering, such as this task, an agile process would have been the
#                              better choice. There are many reasons for this. An agile process delivers working software
#                              frequently. which appeases the customer and is the measure of progress, allowing for a
#                              constant pace of development. It is also more responsive to changes in requirements, even
#                              in later stages of the process, which is especially useful in this context when the
#                              requirements could potentially be changing on a day-by-day basis. With the use of
#                              prototyping, via the agile process, we receive necessary feedback to clarify ambiguities and
#                              ensure that the end software satisfies most of our customers.

#                              4. Groups of 4: If we were instead using the other software development process, how
#                              would have requirements engineering been performed? Give some specific
#                              differences.

#                              During agile development, the requirements are usually gathered in a less 'complete"
#                              manner, where user stories that expand over time are an acceptable choice. The
#                              requirements are also ever-changing, as opposed to plan-driven/ waterfall development
#                              where the requirements are "locked" from the start. This is due to the agile process valuing
#                              individuals and interactions over documentation. Specifically, we wouldn't need to clarify
#                              ambiguities as thoroughly, as feedback would help us to resolve most of these. We would
#                              have more prototyping with earlier versions of systems that we release as beta tests to a few
#                              of our customers who we then receive feedback from, enabling us to see real-world
#                              performance and issues for requirements validation that we could use to further improve
#                              the software."""
#     questions['Task 7'] = """Task 7: Reflection

#                              1. Teamwork: here, reflect on things such as how you got organised, split up
#                              responsibilities between team members, communicated, and managed progress in
#                              working towards the deadline for this coursework. Make sure to mention and reflect
#                              on the use of and usefulness of any tools that you tried out in this process, e.g.
#                              physical tools, or online tools for managing your teamwork.
#                              Our team initially organised a WhatsApp group chat within a day of the team
#                              announcement. From there, we agreed that regular in-person meetings would be the best
#                              way to progress. So, after an initial introductory meeting, we have met face-to-face
#                              Wednesday and Friday regularly. For the agenda of the first work meeting, we had
#                              coursework goals and team goals. The team goals included items such as figuring out which
#                              communication platform will be best and which tools we should use. There were multiple
#                              options for such as Discord, GitHub, Asana, Microsoft. To-do, Teams, OneNote, etc. Due to
#                              the nature of the tasks, we chose OneNote as the main hub to collect the work of individuals
#                              and the group organisation materials, as it makes it easy to segment work between pages
#                              and keep them organised in sections. The syncing features in OneNote ensured that every
#                              member was on the most up to date notes and plans, and minimised conflicts therefore is
#                              considered the most valuable aspect of OneNote by the team. OneNote provided enough
#                              organisation features to make using Discord redundant, so we stuck with WhatsApp. Since
#                              there were no actual programming tasks GitHub would have been redundant therefore, we
#                              didn't use it. The complexity and size of this coursework meant that setting up Microsoft To-
#                              Do would have been more effort than worth.

#                              During meetings, we collectively agreed on the task delegation with their deadlines being
#                              the next meeting. We partitioned tasks between people such as each person coming up with
#                              2-3 stakeholders for task 1 to spread out the workload. We tried Asana to create a visual
#                              timeline with task deadlines clearly represented as well as each subtask recorded and
#                              providing a clear progression towards completion. It turned out to be a good way of
#                              checking our progress, but in this context, we managed well without it. We kept all
#                              management digital and online instead of by hand so that resources are easily distributable
#                              and kept up to date to all team members.

#                              2. The quality of your work: here, reflect on how well you think you tackled the work in
#                              the different tasks. We recommend you have a look at the marking scheme from this
#                              link to help you structure this response, however touching on all criteria from there,
#                              or marking yourself using it is not expected.

#                              We cross-checked our work as often as we could and kept feedback honest, so in our
#                              opinion, the quality of the work is the best we could make it, given that it was decided by
#                              our collective decision whether something was good enough. The OneNote made this
#                              process easy as a collaborative and flexible workspace. We believe that we have found a
#                              large variety of stakeholders, even considering people who may be averse to our efforts,
#                              such as the protestors, as it's important to try to make all parties as satisfied as possible. We
#                              also believe that we have found a fair number of ambiguities, but we do think that there
#                              may be more than we are missing. and perhaps we emphasised lower priority ambiguities
#                              too much like the rating system. Our use-case diagram is easy to understand and includes a
#                              variety of important use-cases that we consider to be quite conclusive, and our descriptions
#                              for them are thorough. We believe that choosing just four use cases to thoroughly describe
#                              is quite limiting on the overall project, however, as more than four are critical for the
#                              functionality of the system, such as payment. Our non-functional requirements answers may
#                              have been the most accurate but were perhaps not the most varied, as we had both
#                              accessibility and usability as categories. Regardless, our use of constructive criticism enabled
#                              each of us to feel confident that the answers which are being submitted are our best effort.
#                              What contributed to this is our research on topics and use of external materials such as use
#                              case templates for clear and concise descriptions, the pros and cons of software
#                              development processes and types of requirements engineering, etc. In conclusion, we are
#                              happy with the work we produced."""
#     questions['Exceptionality'] = """"""

    return questions

class Singleton(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances or cls._instances[cls] is None:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]

    @classmethod
    def reset_instance(cls, instance_class):
        cls._instances[instance_class] = None

class Marker(metaclass=Singleton):
    last_assignment_id = None
    last_submission_id = None
    
    def __init__(self, assignment_id):
        self.questions = None
        self.mark_scheme = None
        self.structure = get_structure(assignment_id)  # Include the predefined question structure
        self.initialsed = False

    def parse_document(self, document, document_type):
        """
        Parse the given document (question paper or mark scheme)
        and update the questions and mark_scheme dictionaries.
        
        :param document: The text content of the document
        :param document_type: 'question_paper' or 'mark_scheme'
        """
        query = f"Here is the content of a {document_type}: {document}. "

        if document_type == "mark scheme":
            query += "Analyze this text and structure the information for each question number as follows: "
            query += "For each question, provide details of the markscheme, including the content covered and the mark worth for each section. "
            query += "Use a structured JSON dictionary format, where each key is a question number (e.g., '1.a.i', '1.a.ii'), "
            query += "and its value contains the markscheme details and the mark worth, formatted as plain text. "
        else:
            query += "Analyze this text and extract the content for each question number. "
            query += "Format the output as a JSON dictionary where each key is a question number and its value is the corresponding content. "

        query += "Please ensure that all text within the JSON values is enclosed in double quotes (\"). "
        query += "Ensure the output follows this example format: "
        query += json.dumps({
            "1.a.i": "[Mark Scheme Info For Question like Guidance] - 1 mark per bullet to max 2",
            "1.a.ii": "[Mark Scheme Info For Question like Guidance] - 1 mark per bullet to max 4",
            # Provide a few more examples to illustrate the format clearly
        }, indent=2)
        query += ". "

        query += f"Given the following structure of questions: {json.dumps(self.structure, indent=2)}. "
        query += "Please format the output as a JSON dictionary where each key is a question number and its value is the corresponding content."

        res = chat(query)

        print(f"parse_{document_type}_raw: {res}")
        return res

    def set_questions(self, questions_src):
        try:
            self.questions = json.loads(self.parse_document(questions_src, "question paper"))
        except json.JSONDecodeError as e:
            # Handle the exception here, e.g., print an error message
            print(f"JSON decode error: {e}")
            self.questions = None
        
    def set_mark_scheme(self, mark_scheme_src):
        try:
            self.mark_scheme = json.loads(self.parse_document(mark_scheme_src, "mark scheme"))
        except json.JSONDecodeError as e:
            # Handle the exception here, e.g., print an error message
            print(f"JSON decode error: {e}")
            self.mark_scheme = None
    
    def initialise(self, questions_src, mark_scheme_src):
        if not self.initialsed:
            self.set_questions(questions_src)
            self.set_mark_scheme(mark_scheme_src)

            self.initialsed = True

    @classmethod
    def reset(cls):
        Singleton.reset_instance(cls)

class Student(metaclass=Singleton):
    last_assignment_id = None
    last_submission_id = None

    def __init__(self, assignment_id):
        # Parse students answer as a json with question number as key and answer as value
        self.student_answer = None
        self.structure = get_structure(assignment_id)
        self.initialsed = False
    
    # Parse the pdf file as a json of question number as key and question as value
    def parse_student_answer(self, raw_student_answer):
        """
        Parse the student's answers and structure them based on the predefined question structure.
        
        :param raw_student_answer: The text content of the student's answers
        """
        # Define the structure of questions to match responses with
        raw_student_answer = raw_student_answer.replace('"', '\\"')
        query = f"Given a student's detailed responses as presented here: '{raw_student_answer}' "
        query += "and considering the structured format of questions and subquestions detailed in the JSON object: "
        query += f"{json.dumps(self.structure, indent=2)}, "
        query += f"your task is to map each response to its corresponding question or subquestion number (e.g. {list(self.structure.keys())[0]}), as defined by the given structure. "
        query += "Format the output as a JSON dictionary where each key is a question number (e.g., '1', '2.a', '3.b.ii'), "
        query += "and its value is the student's answer for that specific question or subquestion, formatted as plain text. "
        query += "Ensure all text within the JSON values is enclosed in double quotes (\"). "
        query += f"Here is an illustrative example of the desired output format, but ensure that the key is the relevent structure, {list(self.structure.keys())[0]}: "
        query += json.dumps({
            "1": "[Answer to question 1 here]",
            "2.a": "[Answer to question 2.a here]",
            "3.b.ii": "[Answer to question 3.b.ii here]",
            # Add more examples if necessary to illustrate the format clearly
        }, indent=2) + "."
        query += " Focus solely on mapping the answers to their respective questions or subquestions in the JSON dictionary, without additional commentary."

        res = chat(query)

        print(f"parse_student_answer_raw: {res}")
        return res

    def set_student_answer(self, student_answer_src):
        try:
            student_answer_raw = self.parse_student_answer(student_answer_src)
            self.student_answer = json.loads(student_answer_raw)
        except json.JSONDecodeError as e:
            # Handle the exception here, e.g., print an error message
            print(f"JSON decode error: {e}")
            self.student_answer = None  # You can set it to None or any other default value
    
    def initialise(self, student_answer_src):
        if not self.initialsed:
            self.set_student_answer(student_answer_src)

            self.initialsed = True

    @classmethod
    def reset(cls):
        Singleton.reset_instance(cls)

class FeedbackGenerator():
    def __init__(self, marker, student):
        self.marker = marker
        self.student = student
        self.initialsed = False

    def generate_feedback_for_question(self, question_id):
        answer = self.student.student_answer.get(question_id, "No answer provided.")
        mark_scheme_entry = self.marker.mark_scheme.get(question_id)

        if mark_scheme_entry is not None:
            positive_start = self.generate_gpt_feedback(answer, mark_scheme_entry, "positive_start")
            constructive_middle = self.generate_gpt_feedback(answer, mark_scheme_entry, "constructive_middle")
            positive_end = self.generate_gpt_feedback(answer, mark_scheme_entry, "positive_end", positive_start + " " + constructive_middle)

            return {
                "positive_start": positive_start,
                "constructive_middle": constructive_middle,
                "positive_end": positive_end
            }
        else:
            return {"positive_start": "No mark scheme entry found for this question.",
                    "constructive_middle": "",
                    "positive_end": ""}

    def generate_gpt_feedback(self, student_answer, mark_scheme_entry, feedback_type, previous_feedback=""):
        # Adding context for GPT based on the feedback type
        if feedback_type == "positive_start":
            query = f"Given this student's answer: '{student_answer}', write a brief positive comment in about three sentences in second person."
        elif feedback_type == "constructive_middle":
            query = f"With the mark scheme in mind: '{mark_scheme_entry}', suggest an improvement for the answer '{student_answer}' in about three sentences in second person."
        elif feedback_type == "positive_end":
            # For positive_end, use the previous feedback to provide context
            query = (f"Considering the previous feedback and the student's answer: '{student_answer}', "
                     f"conclude with a motivational comment in about three sentences in second person."
                     f"Focus on overall performance without repeating earlier feedback.")

        # Call the GPT model here and return the response
        gpt_response = chat(query)  # Replace with actual GPT call

        return gpt_response
    
    def initialise(self):
        if not self.initialsed:
            self.initialsed = True

# Parse the txt file
def parse_txt(txt_path):
    with open(txt_path, 'r') as file:
        data = file.read().replace('\n', '')
    return data

def print_progress(progress):
    print(f"--> Request {progress}% Processed", end='\r')