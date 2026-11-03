import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Markdown, { type ASTNode, type RenderRules } from 'react-native-markdown-display';

import { colors, radii, spacing, typography } from '@/theme';

/** Fenced and indented code blocks: monospace on a darker surface, scrolling horizontally (AC-13). */
function CodeBlock({ node }: { node: ASTNode }) {
  return (
    <View key={node.key} style={styles.codeBlock} testID="chat_code_block">
      <ScrollView testID="chat_code_scroll" horizontal showsHorizontalScrollIndicator>
        <Text style={styles.codeText} selectable={false}>
          {node.content.replace(/\n$/, '')}
        </Text>
      </ScrollView>
    </View>
  );
}

const rules: RenderRules = {
  fence: (node) => <CodeBlock key={node.key} node={node} />,
  code_block: (node) => <CodeBlock key={node.key} node={node} />,
};

interface Props {
  children: string;
}

export function MarkdownMessage({ children }: Props) {
  const style = useMemo(() => markdownStyles, []);
  return (
    <Markdown style={style} rules={rules}>
      {children}
    </Markdown>
  );
}

const markdownStyles = StyleSheet.create({
  body: { ...typography.body, color: colors.text },
  paragraph: { marginTop: 0, marginBottom: spacing.s },
  heading1: { ...typography.title, fontSize: 22, lineHeight: 28, marginBottom: spacing.s },
  heading2: { ...typography.title, fontSize: 20, lineHeight: 26, marginBottom: spacing.s },
  heading3: { ...typography.title, marginBottom: spacing.s },
  strong: { fontWeight: '700' },
  code_inline: {
    ...typography.mono,
    backgroundColor: colors.codeBackground,
    borderRadius: radii.code,
    color: colors.text,
  },
  bullet_list: { marginBottom: spacing.s },
  ordered_list: { marginBottom: spacing.s },
});

const styles = StyleSheet.create({
  codeBlock: {
    backgroundColor: colors.codeBackground,
    borderRadius: radii.code,
    padding: spacing.m,
    marginBottom: spacing.s,
  },
  codeText: { ...typography.mono, color: colors.text },
});
