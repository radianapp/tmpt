// app/dev/regex/js/modules/devops/code-gen.js

export function generateCode(pattern, flags, language) {
  const safePattern = pattern.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  
  switch (language) {
    case 'js':
      return `// JavaScript ES6
const regex = /${pattern}/${flags};
const text = "Teks pengujian Anda";

// 1. Pengujian kecocokan (test match)
const isMatch = regex.test(text);
console.log('Match:', isMatch);

// 2. Ambil semua kecocokan (find all matches)
const matches = [...text.matchAll(regex)];
matches.forEach((match, index) => {
  console.log(\`Kecocokan \${index + 1}: \${match[0]} pada indeks \${match.index}\`);
});`;

    case 'python':
      return `# Python re module
import re

pattern = re.compile(r'${pattern}'${flags.includes('i') ? ', re.IGNORECASE' : ''})
text = "Teks pengujian Anda"

# 1. Pengujian kecocokan (test match)
is_match = bool(pattern.search(text))
print('Match:', is_match)

# 2. Ambil semua kecocokan (find all matches)
matches = pattern.finditer(text)
for index, match in enumerate(matches):
    print(f"Kecocokan {index + 1}: {match.group()} pada indeks {match.start()}")`;

    case 'go':
      return `package main

import (
\t"fmt"
\t"regexp"
)

func main() {
\tpattern := \`${pattern}\`
\ttext := "Teks pengujian Anda"

\tregex, err := regexp.Compile(pattern)
\tif err != nil {
\t\tpanic(err)
\t}

\t// 1. Pengujian kecocokan (test match)
\tisMatch := regex.MatchString(text)
\tfmt.Println("Match:", isMatch)

\t// 2. Ambil semua kecocokan (find all matches)
\tmatches := regex.FindAllString(text, -1)
\tfor index, match := range matches {
\t\tfmt.Printf("Kecocokan %d: %s\\n", index+1, match)
\t}
}`;

    case 'java':
      return `import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class RegexTest {
    public static void main(String[] args) {
        String patternStr = "${safePattern}";
        String text = "Teks pengujian Anda";

        Pattern pattern = Pattern.compile(patternStr${flags.includes('i') ? ', Pattern.CASE_INSENSITIVE' : ''});
        Matcher matcher = pattern.matcher(text);

        // 1. Pengujian kecocokan
        boolean isMatch = matcher.find();
        System.out.println("Match: " + isMatch);

        // Reset matcher untuk mencari semua
        matcher.reset();
        int index = 1;
        while (matcher.find()) {
            System.out.println("Kecocokan " + index + ": " + matcher.group() + " di indeks " + matcher.start());
            index++;
        }
    }
}`;

    default:
      return '// Bahasa tidak dikenal.';
  }
}
