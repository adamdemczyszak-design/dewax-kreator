# DEWAX Kreator

## Praca z subagentami (Claude = szef, nie wykonawca)

Ustalone z właścicielem 22.10.2026.

1. Główny Claude planuje, rozdziela zadania i sprawdza wyniki.
2. Większą robotę oddaje subagentom (narzędzie Agent):
   - szukanie po wielu plikach albo źródłach,
   - kilka niezależnych zadań naraz, puszczanych równolegle w jednej wiadomości.
3. Drobiazgi (jedno wyszukanie, jeden plik, krótka odpowiedź) robi sam, bo subagent też zużywa limit.
4. Dobór modelu subagenta (parametr `model`):
   - `haiku`: szukanie i czytanie,
   - `opus`: edycja i pisanie,
   - `fable`: najtrudniejsze rzeczy (analiza, trudne błędy).
5. Jeden subagent = jedno zadanie, z jasnym celem i zakresem w poleceniu.
6. Główny Claude czyta tylko raport subagenta, a kluczowe wnioski sprawdza u źródła, zanim poda je właścicielowi.

## Zasady

1. Gdy Adam poprawi moją odpowiedź (np. "to nie tak", "zrób inaczej", "źle"), zaproponuj jedną krótką, ogólną zasadę, która zapobiegnie temu błędowi w przyszłości. Pokaż ją i zapytaj, czy dopisać ją do CLAUDE.md. Dopisuj tylko po jego "tak", bez dublowania istniejących reguł.
2. Przy wycenie wstępnej przyjmuj wartości optymistyczne (górny zakres normy), bo konkurencja tak wycenia. Dokładne wartości ustala się po wizji lokalnej i zastrzega w ofercie.
