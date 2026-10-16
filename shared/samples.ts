export const samples = [
  {
    id: "a",
    title: "An ordinary exchange",
    subtitle: "Scheduling a campus visit",
    text: `Advisor: Hi Alex, your campus visit is booked for Tuesday at 10 am. The details are in your existing student portal.
Alex: Thanks. Is there anything I should bring?
Advisor: Just your questions. There is no fee for the visit. You can confirm the booking with the admissions desk using the number on your university website.
Alex: Great, I will check my portal. See you Tuesday.`,
  },
  {
    id: "b",
    title: "The scholarship offer",
    subtitle: "Trust, then a price",
    text: `Coordinator: Hello, I represent the Northbridge Scholarship Office. Your academic profile has been shortlisted for our international award.
Alex: I do not remember applying. Could you tell me more?
Coordinator: Congratulations. You are guaranteed a scholarship worth $8,000. There is no processing fee.
Alex: How can I confirm this with the university?
Coordinator: Your place expires in 30 minutes. Pay a processing fee of $180 to release the award at https://northbridge.edu.awards-portal.example/claim.
Coordinator: Keep this confidential. Do not contact the university, as that will delay your award. Send your passport scan and bank account details today.`,
  },
  {
    id: "c",
    title: "The verification request",
    subtitle: "An identity behind a link",
    text: `Support: I am an officer from the International Student Registry. We need to verify your enrollment.
Student: I already verified this with my college.
Support: Your account will be suspended today unless you complete the verification at https://student-registry.example/verify.
Support: Upload your passport and send your one-time code to me. Do not tell anyone about this security check.
Student: Can I contact the registry directly?
Support: Act immediately. This is your final warning.`,
  },
] as const;
